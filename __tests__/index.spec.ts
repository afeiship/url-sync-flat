/**
 * @jest-environment jsdom
 */

import UrlSyncFlatClass from '../src';

describe('UrlSyncFlatClass', () => {
  const setLocation = (url: string) => {
    // use history.replaceState to update jsdom location
    window.history.replaceState(null, '', url);
  };

  beforeEach(() => {
    // reset url and any timers/handlers
    setLocation('/');
    jest.useRealTimers();
  });

  afterEach(() => {
    // ensure no leftover popstate handlers from tests
    // (individual tests should detach when needed)
  });

  test('readInitialState with fields + prefix parses numbers/booleans and applies defaults', () => {
    setLocation('/?t_page=2&t_flag=true&other=hello');

    const sync = new UrlSyncFlatClass({ prefix: 't_', fields: ['page', 'flag', 'missing'] });

    const state = sync.readInitialState({ defaults: { missing: 5 } });

    expect(state.page).toBe(2);
    expect(state.flag).toBe(true);
    expect(state.missing).toBe(5);
    // other query keys should be ignored because fields list is provided
    expect((state as any).other).toBeUndefined();
  });

  test('serializeStateToUrl sets, deletes keys and respects replaceState', () => {
    setLocation('/?keep=1');

    const sync = new UrlSyncFlatClass({ prefix: 'p_', fields: ['a', 'b'], replaceState: true });

    // write a= 'x' and b undefined -> should delete both p_b and b
    sync.serializeStateToUrl({ a: 'x', b: undefined });

    const qp = new URLSearchParams(window.location.search);
    expect(qp.get('keep')).toBe('1');
    expect(qp.get('p_a')).toBe('x');
    expect(qp.has('p_b')).toBe(false);
    expect(qp.has('b')).toBe(false);
  });

  test('serializeStateToUrl uses pushState when replaceState is false', () => {
    setLocation('/?orig=1');
    const sync = new UrlSyncFlatClass({ prefix: 'x_', fields: ['v'], replaceState: false });

    sync.serializeStateToUrl({ v: 42 });

    const qp = new URLSearchParams(window.location.search);
    expect(qp.get('x_v')).toBe('42');
    expect(qp.get('orig')).toBe('1');
  });

  test('schedule/flush/cancel debounce behavior', () => {
    jest.useFakeTimers();
    setLocation('/');

    const sync = new UrlSyncFlatClass({ prefix: '', fields: [], debounceMs: 100 });

    // schedule should delay writing
    sync.schedule({ a: 1 });
    // before timers run, no query
    expect(window.location.search).toBe('');
    // advance less than debounce
    jest.advanceTimersByTime(50);
    expect(window.location.search).toBe('');
    // advance to trigger
    jest.advanceTimersByTime(60);
    expect(new URLSearchParams(window.location.search).get('a')).toBe('1');

    // test cancel
    sync.schedule({ b: 2 });
    sync.cancel();
    jest.advanceTimersByTime(200);
    expect(new URLSearchParams(window.location.search).get('b')).toBeNull();

    // test flush (immediate write)
    sync.schedule({ c: 3 });
    // flush should write immediately
    sync.flush({ c: 3 });
    expect(new URLSearchParams(window.location.search).get('c')).toBe('3');

    jest.useRealTimers();
  });

  test('attachPopstateListener triggers on popstate and detach removes it', () => {
    setLocation('/?t_n=3');

    const sync = new UrlSyncFlatClass({ prefix: 't_', fields: ['n'] });
    const onChange = jest.fn();

    const detach = sync.attachPopstateListener((next) => {
      onChange(next);
    });

    // change url and dispatch popstate
    window.history.pushState(null, '', '/?t_n=4');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].n).toBe(4);

    // detach and dispatch again -> should not be called further
    detach();
    window.history.pushState(null, '', '/?t_n=5');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('readInitialState without fields reads all keys (removes prefix)', () => {
    setLocation('/?a=1&pref_x=hello&pref_y=10&z=false');

    const sync = new UrlSyncFlatClass({ prefix: 'pref_', fields: [] }); // empty fields => read all
    const state = sync.readInitialState();

    expect(state.a).toBe(1);
    expect(state.x).toBe('hello'); // pref_ removed
    expect(state.y).toBe(10); // numeric parsed
    expect(state.z).toBe(false); // boolean parsed
  });
});