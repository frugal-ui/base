/*
	REACTIVITY
*/
// STATE
/**
 * Function that can subscribe to a State.
 * When the State updates, this function is called.
 */
type StateSubscription<T> = (newValue: T) => void;

/**
 * Configuration for a StateProxy.
 */
interface StateProxyCfg<T, P> {
    /**
     * Converts a value with type of the Proxy<P> to the type of the State<T>
     * This function may be omitted if the proxy State will be read only.
     */
    convertToOriginal?: (proxyValue: P) => T;
    /** Converts a value with type of the State<T> to the type of the Proxy<P> */
    convertToProxy: (originalValue: T) => P;
}

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
     * Sets a new value for the state and calls all subscribing functions.
     * If the new value equals the current one, the function exits immediately.
     */
    set value(newValue: T) {
        if (this._value == newValue) return;
        this._value = newValue;
        this.callSubscriptions();
    }

    /**
     * Calls all subscribing functions
     */
    callSubscriptions(): void {
        this._bindings.forEach((fn) => fn(this._value));
    }

    /**
     * Adds a subscribing function (StateSubscription)
     */
    subscribe(fn: StateSubscription<T>): void {
        this._bindings.add(fn);
    }
    /**
     * Removes a subscribing function (StateSubscription)
     */
    unsubscribe(fn: StateSubscription<T>): void {
        this._bindings.delete(fn);
    }

    /**
     * Creates a new State<P> bound to the state this method is called on.
     * When State<P> changes, it's value is converted and used to update this State<T>.
     * When this State<T> changes, it's value is converted and used to update the new State<P>.
     */
    createProxy<P>(cfg: StateProxyCfg<T, P>): State<P> {
        const proxyState = new State<P>(cfg.convertToProxy(this._value));
        this.subscribe(
            (newValue) => (proxyState.value = cfg.convertToProxy(newValue)),
        );
        proxyState.subscribe((newValue) => {
            if (!cfg.convertToOriginal) return;
            this.value = cfg.convertToOriginal(newValue);
        });
        return proxyState;
    }
}