const EventEmitter = require("eventemitter3");

class AppEvent {
  constructor(name, emitter) {
    this._name = name;
    this._emitter = emitter;
  }

  getName = () => this._name;

  emit = data => {
    this._emitter.emit(this._name, data);
  };

  once = callbackOnce => {
    this._emitter.once(this._name, callbackOnce);
    return {
      unsubscribe: () => {
        this._emitter.off(this._name, callbackOnce);
      }
    };
  };

  subscribe = callback => {
    this._emitter.on(this._name, callback);
    return {
      unsubscribe: () => {
        this._emitter.off(this._name, callback);
      }
    };
  };
}

class AppEventRegistry {
  constructor(events) {
    this._emitter = new EventEmitter();
    this._events = {};
    for (let name of events) {
      this._events[name] = new AppEvent(name, this._emitter);
    }
  }

  get(name) {
    const appEvent = this._events[name];
    if (!appEvent) {
      throw new Error(`rev-cms-core: AppEventRegistry: no such name "${name}"`);
    }
    return appEvent;
  }
}

export default AppEventRegistry;
