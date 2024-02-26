import './styles/reset.css';
import './styles/theme-implementation.css';

import {
    CSSPropertyNames,
    PrefixedCSSPropertyNames,
} from './assets/css-property-names';

// IMPORTS
import AccessibilityRoleMap from './assets/roles';

/*
	UTILITY
*/
/**
 * Stringifiable object.
 * Has .toString() => string method.
 */
export interface Stringifiable {
    toString(): string;
}
/**
 * Object of type T or State<T>
 */
export type ValueObject<T> = T | State<T>;
/**
 * Universally Unique Identifier
 */
export class UUID implements Stringifiable {
    readonly value: string;

    constructor() {
        let uuid = '';
        const chars = '0123456789abcdef';

        for (let i = 0; i < 36; i++) {
            if (i === 8 || i === 13 || i === 18 || i === 23) {
                uuid += '-';
            } else if (i === 14) {
                uuid += '4';
            } else if (i === 19) {
                uuid += chars[(Math.random() * 4) | 8];
            } else {
                uuid += chars[(Math.random() * 16) | 0];
            }
        }

        this.value = uuid;
    }

    /**
     * @returns UUID as string
     */
    toString() {
        return this.value;
    }
}

/**
 * Converts ValueObject<T> to T:
 * If the ValueObject<T> is a State<T>, the the State's value is returned
 * If the ValueObject is T, the ValueObject itself is returned
 * @param valueObject ValueObject to convert
 * @returns Value of ValueObject
 */
export function unwrapValue<T>(valueObject: ValueObject<T>): T {
    if (valueObject instanceof State) return valueObject.value;
    return valueObject;
}
/**
 * Converts ValueObject<T> to State<T>:
 * If the ValueObject<T> is a State<T>, the the State itself is returned
 * If the ValueObject is T, a State is created with the ValueObject as value
 * @param valueObject ValueObject to convert
 * @returns State
 */
export function unwrapState<T>(valueObject: ValueObject<T>): State<T> {
    if (valueObject instanceof State) return valueObject;
    return new State(valueObject);
}

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
     * @param fn Function to call on change
     */
    subscribe(fn: StateSubscription<T>): void {
        this._bindings.add(fn);
    }
    /**
     * Removes a subscribing function (StateSubscription)
     * @param fn Function to remove from subscriptions
     */
    unsubscribe(fn: StateSubscription<T>): void {
        this._bindings.delete(fn);
    }

    /**
     * Creates a new State<P> bound to the state this method is called on.
     * When State<P> changes, it's value is converted and used to update this State<T>.
     * When this State<T> changes, it's value is converted and used to update the new State<P>.
     * @param cfg Configuration for proxy
     * @returns New proxy State
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
     * @param items Items to add to selection
     */
    select(...items: T[]): void {
        items.forEach((item) => this._selection.add(item));
        this.update();
    }
    /**
     * Removes items from the selection and call subscriptions
     * @Param items Items to remove from selection
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
     * @param item Item to check
     */
    checkIsSelected(item: T): boolean {
        return this._selection.has(item);
    }
    /**
     * Returns selected items
     * @returns All selected items as Array
     */
    getItems(): T[] {
        return [...this._selection.values()];
    }

    private update() {
        // automatically calls subscriptions
        this.value = this.getItems();
    }
}

/*
	INTERFACE
*/
// TYPES
/**
 * HTML Element
 */
export interface Component<V> extends HTMLElement, Styleable {
    /**
     * Value of the Component
     */
    value: V;
    /**
     * Provides access to component in callback function.
     * Use if component must be accessed as variable.
     */
    access: (accessFn: (self: this) => void) => this;

    /**
     * Sets ARIA-label
     */
    setAccessibilityLabel: (label: ValueObject<string>) => this;
    /**
     * Sets ARIA-role
     */
    setAccessibilityRole: (roleName: keyof AccessibilityRoleMap) => this;
    /**
     * Sets tabindex so that the component can be focused via keyboard
     */
    allowKeyboardFocus: () => this;

    //attributes
    /**
     * Sets id atribute
     */
    setID: (id: string | UUID) => this;
    /**
     * Sets HTML attribute
     */
    setAttr: (key: string, value?: ValueObject<Stringifiable>) => this;
    /**
     * Removes HTML attribute
     */
    rmAttr: (key: string) => this;
    /**
     * Toggles HTML attribute based on condition
     */
    toggleAttr: (key: string, condition: ValueObject<boolean>) => this;
    /**
     * Resets HTML className
     */
    addToClass: (value: string) => this;
    /**
     * Toggles HTML className
     */
    resetClasses: (value: string) => this;
    /**
     * Removes HTML className
     */
    removeFromClass: (value: string) => this;
    /**
     * Toggles HTML className based on condition
     */
    toggleClass: (value: string, condition: ValueObject<boolean>) => this;

    //children
    /**
     * Appends child Components
     */
    addItems: (...children: Component<any>[]) => this;
    /**
     * Prepends child Components
     */
    prependItems: (...children: Component<any>[]) => this;
    /**
     * Clears innerHTML
     */
    clear: () => this;
    /**
     * Sets child Components by array
     */
    setItems: (children: ValueObject<Component<any>[]>) => this;

    //content
    /**
     * Sets innerText
     */
    setText: (text: ValueObject<Stringifiable>) => this;
    /**
     * Sets value
     */
    setValue: (value: ValueObject<V>) => this;
    /**
     * Sets innerHTML
     */
    setHTML: (text: ValueObject<string>) => this;

    //events
    /**
     * Adds eventListener
     */
    on: (
        eventName: keyof HTMLElementEventMap,
        handler: ComponentEventHandler,
    ) => this;
    /**
     * Removes eventListener
     */
    removeListener: (
        eventName: keyof HTMLElementEventMap,
        handler: ComponentEventHandler,
    ) => this;

    //states
    /**
     * Subscribes to a State and calls the StateSubscription immediately.
     * @param state State to subscribe to
     * @param fn StateSubscription to trigger on change of State
     * @returns Component (this)
     */
    subscribeToState: <T>(state: State<T>, fn: StateSubscription<T>) => this;
}

/**
 * Component with checked: boolean property.
 */
export interface CheckableComponent<T> extends Component<T> {
    checked: boolean;
}

/**
 * HTML Event handler
 */
export type ComponentEventHandler = (this: HTMLElement, e: Event) => void;

/**
 * Element with each key of the PrefixedCSSPropertyNames map being a function to set that style.
 * For instance, Styleable.cssWidth(value: Stringifiable) would set the width style.
 */
export type Styleable = {
    [property in keyof typeof PrefixedCSSPropertyNames]: (
        value: ValueObject<Stringifiable>,
    ) => Component<any>;
};

// IMPLEMENTATION
export function Component<ValueType>(
    tagName: keyof HTMLElementTagNameMap,
): Component<ValueType> {
    //create
    const component = document.createElement(
        tagName,
    ) as unknown as Component<ValueType>;

    //styles
    Object.entries(PrefixedCSSPropertyNames).forEach((entry) => {
        const prefixedCssPropertyName =
            entry[0] as keyof typeof PrefixedCSSPropertyNames;
        const cssPropertyName = entry[1] as keyof typeof CSSPropertyNames;

        component[prefixedCssPropertyName] = (
            newStyle: ValueObject<Stringifiable>,
        ) => {
            const state = unwrapState(newStyle);
            component.subscribeToState(state, (newValue) => {
                (component.style as any)[cssPropertyName] = newValue;
            });
            return component;
        };
    });

    //methods
    component.access = (fn) => {
        fn(component);
        return component;
    };
    component.setAccessibilityLabel = (label) => {
        component.setAttr('aria-label', label);
        return component;
    };
    component.setAccessibilityRole = (roleName) => {
        component.setAttr('role', roleName);
        return component;
    };
    component.allowKeyboardFocus = () => {
        component.setAttr('tabIndex', 0);
        return component;
    };

    //attributes
    component.setID = (id) => {
        component.id = id.toString();
        return component;
    };
    component.setAttr = (key, value = '') => {
        const state = unwrapState(value);

        component.subscribeToState(state, (newValue) => {
            component.setAttribute(key, newValue.toString());
        });

        return component;
    };
    component.rmAttr = (key) => {
        component.removeAttribute(key);
        return component;
    };
    component.toggleAttr = (key, condition) => {
        const subscribe = unwrapState(condition);

        component.subscribeToState(subscribe, (newValue) => {
            if (newValue == true) component.setAttribute(key, '');
            else component.removeAttribute(key);
        });

        return component;
    };
    component.resetClasses = () => {
        component.className = '';
        return component;
    };
    component.removeFromClass = (className) => {
        component.classList.remove(className);
        return component;
    };
    component.addToClass = (className) => {
        component.classList.add(className);
        return component;
    };
    component.toggleClass = (className, condition) => {
        const state = unwrapState(condition);

        component.subscribeToState(state, (newValue) => {
            component.classList.toggle(className, newValue);
        });

        return component;
    };

    //children
    component.addItems = (...children) => {
        children.forEach((child) => {
            component.appendChild(child);
        });
        return component;
    };
    component.prependItems = (...children) => {
        children.forEach((child) => {
            component.insertBefore(child, component.firstChild);
        });
        return component;
    };
    component.clear = () => {
        component.innerHTML = '';
        return component;
    };
    component.setItems = (children) => {
        const state = unwrapState(children);

        component.subscribeToState(state, (children) => {
            component.clear().addItems(...children);
        });

        return component;
    };

    //content
    component.setText = (text) => {
        const state = unwrapState(text);

        component.subscribeToState(state, (newValue) => {
            component.innerText = newValue.toString();
        });

        return component;
    };
    component.setValue = (value) => {
        const state = unwrapState(value);

        component
            .subscribeToState(state, (newValue) => {
                component.value = newValue;
            })
            .on('input', () => (state.value = component.value));

        return component;
    };
    component.setHTML = (text) => {
        const state = unwrapState(text);

        component.subscribeToState(state, (newValue) => {
            component.innerHTML = newValue;
        });

        return component;
    };

    //events
    component.on = (eventName, handler) => {
        component.addEventListener(eventName, handler);
        return component;
    };
    component.removeListener = (eventName, handler) => {
        component.addEventListener(eventName, handler);
        return component;
    };

    //state
    component.subscribeToState = (state, fn) => {
        state.subscribe(fn);
        fn(state.value);
        return component;
    };

    return component.addToClass('frugal-ui-components');
}

// SPECIFIC
/**
 * HTML Anchor (<a>) element
 * @param address Address to open when clicked / value of the [href] attribute
 * @param label Text to be displayed
 */
export function Anchor(
    address: ValueObject<Stringifiable>,
    label: ValueObject<Stringifiable>,
): Component<unknown> {
    return Text('a', label).setAttr('href', address);
}

/**
 * Generic container of the defined type (tag)
 * @param tagName TagName of the container
 * @param children Children to append
 */
export function Container(
    tagName: keyof HTMLElementTagNameMap,
    ...children: Component<any>[]
): Component<unknown> {
    return Component(tagName).addItems(...children);
}

/**
 * Container that horizontally stacks its children via flexbox
 * @param children Children to append
 */
export function HStack(...children: Component<any>[]): Component<unknown> {
    return Container('div', ...children).addToClass('stacks-horizontal');
}

/**
 * Icon (image with specific styles).
 * FrugalUI does not include an icon library, you have to obtain your icons manually.
 *
 * -> The IBM carbon icon library is recommened.
 * -> SVGs are strongly recommended here.
 * @param path
 */
export function Icon(path: ValueObject<string>): Component<unknown> {
    const pathState = unwrapState(path);
    const url = pathState.createProxy({
        convertToProxy: (path) => `url('${path}')`,
    });
    return Component('div').addToClass('icons').cssWebkitMaskImage(url);
}

/**
 * Image.
 * Behind the scenes, this is a div with a background image.
 * The image is set to size:cover and position:center.
 *
 * -> You have to set the height manually.
 * @param src Source of the image, relative to index.css
 */
export function Image(src: ValueObject<string>): Component<unknown> {
    const srcState = unwrapState(src);
    const url = srcState.createProxy({
        convertToProxy: (src) => `url('${src}')`,
    });

    return Component('div')
        .cssBackgroundImage(url)
        .addToClass('images-background');
}

export function Label(
    text: ValueObject<string>,
    labeledItem: Component<any>,
): Component<unknown> {
    return Text('label', text).addItems(labeledItem);
}

/**
 * Generic text of the defined type (tag)
 * @param tagName TagName of the text
 * @param value Text to be displayed
 */
export function Text(
    tagName: keyof HTMLElementTagNameMap,
    value: ValueObject<Stringifiable>,
) {
    return Component(tagName).setText(value);
}

/**
 * Container that vertically stacks its children via flexbox
 * @param children Children to append
 */
export function VStack(...children: Component<any>[]): Component<unknown> {
    return Container('div', ...children).addToClass('stacks-vertical');
}
