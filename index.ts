/*
	DATA
*/
// STATE
/**
 * Function that can subscribe to a State.
 * When the State updates, this function is called.
 */
export type StateSubscription<T> = (newValue: T) => void;

/**
 * Configuration for a StateProxy.
 */
export interface StateProxyCfg<T, P> {
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
export class State<T> {
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

// SELECTION
/**
 * State whose value is a Set<T> representing the selected items.
 * Allows to select and deselect items of type T.
 * Selecting and deselecting items will call subscriptions.
 */
export class SelectionState<T> extends State<T[]> {
    private _selection = new Set<T>();

    constructor() {
        super([]);
    }

    /**
     * Adds items to the selection and call subscriptions
     */
    select(...items: T[]): void {
        items.forEach((item) => this._selection.add(item));
        this.update();
    }
    /**
     * Removes items from the selection and call subscriptions
     */
    deselect(...items: T[]): void {
        items.forEach((item) => this._selection.delete(item));
        this.update();
    }
    /**
     * Clears the selection and call subscriptions and call subscriptions
     */
    clear(): void {
        this._selection.clear();
        this.update();
    }

    /**
     * Checks if an item is selected
     */
    checkIsSelected(item: T): boolean {
        return this._selection.has(item);
    }
    /**
     * Returns selected items
     */
    getItems(): T[] {
        return [...this._selection.values()];
    }

	private update() {
		// automatically calls subscriptions
		this.value = this.getItems();
	}
}