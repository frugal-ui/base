/*
	REACTIVITY
*/
// STATE
/**
 * A State's purpose is to hold a value of type T and allow getting and setting this value.
 * Every time the value is changed, the the State triggers all subscribing functions (cf. StateSubscription).
 */
class State<T> {
    private _value: T;
    private _bindings = new Set<StateSubscription<T>>();

    constructor(initialValue: T) {
        this._value = initialValue;
    }

	/**
	 * Gets the current value of the state
	 */
    get value(): T {
        return this._value;
    }
	/**
	 * Sets a new value for the state and calls all subscribing functions
	 */
    set value(newValue: T) {
        this._value = newValue;
        this._bindings.forEach((fn) => fn(this._value));
    }

	/**
	 * Adds a subscribing function (StateSubscription)
	 */
    subscribe(fn: StateSubscription<T>) {
        this._bindings.add(fn);
    }
	/**
	 * Removes a subscribing function (StateSubscription)
	 */
    unsubscribe(fn: StateSubscription<T>) {
        this._bindings.delete(fn);
    }
}

type StateSubscription<T> = (newValue: T) => void;