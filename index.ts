/*
	REACTIVITY
*/
class State<T> {
    private _value: T;
    private _bindings = new Set<StateSubscription<T>>();

    constructor(initialValue: T) {
        this._value = initialValue;
    }

    get value(): T {
        return this._value;
    }
    set value(newValue: T) {
        this._value = newValue;
        this._bindings.forEach((fn) => fn(this._value));
    }

    subscribe(fn: StateSubscription<T>) {
        this._bindings.add(fn);
    }
    unsubscribe(fn: StateSubscription<T>) {
        this._bindings.delete(fn);
    }
}

type StateSubscription<T> = (newValue: T) => void;