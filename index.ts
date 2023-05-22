import { UUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
export function UUID() {
    return uuidv4();
}

/* UTILITY */
// GENERAL
type Configuration<Default> = {
    [key in keyof Default]: Default[keyof Default];
};

/* REACTIVITY */
// GENERAL
/** Object holding a value. Used by UI components. */
export type ValueObject<T> = T | State<T>;

/** Allows reactive programming. */
export interface BindableObject<T> {
    uuid: string;
    value: T;
    triggerBinder: (binder: Binding<T>) => void;
    triggerAll: (options: BindingActionConfig) => void;
    addBinder: (binder: Binding<T>) => void;
    removeBinder: (binder: Binding<T>) => void;
}

export const defaultBindableResponderConfig = {
    safeToPropagate: true,
}
type BindingActionConfig = Configuration<typeof defaultBindableResponderConfig>;
export type BindingAction<T> = (newValue: T, details: BindingActionConfig) => void;

/** Can be added to a BindableObject. */
export interface Binding<T> {
    uuid: string;
    responder: BindingAction<T>;
}

/** Converts ValueObject to raw value. */
export function unwrapValue<T>(valueObject: ValueObject<T>): T {
    if (valueObject instanceof State) return valueObject.value;
    else return valueObject;
}
/** Converts ValueObject to BindableObject. */
export function unwrapBindable<T>(valueObject: ValueObject<T>): BindableObject<T> {
    if (valueObject instanceof State) return valueObject;
    else {
        let responder: BindingAction<T> | undefined;

        return {
            value: valueObject,
            uuid: UUID(),
            triggerBinder: () => {
                if (responder)
                    responder(valueObject, defaultBindableResponderConfig);
            },
            triggerAll: () => {
                if (responder)
                    responder(valueObject, defaultBindableResponderConfig);
            },
            addBinder: (binder) => {
                responder = binder.responder;
            },
            removeBinder: () => null,
        }
    }
}

// STATE
/** Reactive Variable. Binders will be triggered on change. */
export class State<T> implements BindableObject<T> {
    uuid = UUID();

    private _value: T;
    private binders = new Map<Binding<T>['uuid'], Binding<T>['responder']>();

    constructor(value: T) {
        this._value = value;
    }

    /* basic */
    get value() {
        return this._value;
    }

    set value(newValue: T) {
        this._value = newValue;
        this.triggerAll(defaultBindableResponderConfig);
    }

    /* reactivity */
    triggerBinder(binder: Binding<T>) {
        binder.responder(this.value, defaultBindableResponderConfig);
    }
    triggerAll(options: BindingActionConfig) {
        this.binders.forEach(responder => {
            responder(this.value, options);
        })
    }
    addBinder(binder: Binding<T>) {
        this.binders.set(binder.uuid, binder.responder);
    }
    removeBinder(binder: Binding<T>) {
        this.binders.delete(binder.uuid);
    }
}

/* COMPONENTS */
// GENERAL
export type ComponentEventHandler = (this: HTMLElement, e: Event) => void;

/** UI Component. */
export interface Component extends HTMLElement {
    access: (accessFn: (self: this) => void) => this;

    //children
    addItems: (...children: Component[]) => this;
    addItemsBefore: (...children: Component[]) => this;

    //attributes
    setID: (id: string) => this;
    setAttr: (key: string, value?: string) => this;
    rmAttr: (key: string) => this;
    toggleAttr: (key: string, condition: ValueObject<boolean>) => this;
    resetClasses: (value: string) => this;
    removeFromClass: (value: string) => this;
    addToClass: (value: string) => this;
    addToClassConditionally: (value: string, condition: ValueObject<boolean>) => this;
    setStyle: (property: keyof CSSStyleDeclaration, value: string) => this;

    //content
    setText: (text: ValueObject<string>) => this;
    /** Passes unwrapped value into compute() function. Result of compute() will be textContent. */
    computeText: <T>(object: ValueObject<T>, compute: (unwrappedObject: T) => string) => this;
    setHTML: (text: ValueObject<string>) => this;
    /** Passes unwrapped value into compute() function. Result of compute() will be innerHTML. */
    computeHTML: <T>(object: ValueObject<T>, compute: (unwrappedObject: T) => string) => this;

    //events
    listen: <T extends Event>(eventName: keyof HTMLElementEventMap, handler: ComponentEventHandler) => this;
    ignore: <T extends Event>(eventName: keyof HTMLElementEventMap, handler: ComponentEventHandler) => this;

    //state
    /** Tracks binders of the component. Key is BindableObject.uuid, value is the Binder. */
    binders: Map<string, Binding<any>>;
    bind: <T>(bindable: BindableObject<T>, responder: BindingAction<T>) => this;
    unbind: <T>(bindable: BindableObject<T>) => this;
    update: <T>(bindable: BindableObject<T>) => this;
}

export function Component(tagName: keyof HTMLElementTagNameMap): Component {
    //create
    const component = document.createElement(tagName) as Component;

    //methods
    component.access = (fn) => {
        fn(component);
        return component;
    }

    component.addItems = (...children) => {
        component.append(...children);
        return component;
    }
    component.addItemsBefore = (...children) => {
        component.append(...children);
        return component;
    }

    component.setID = (id) => {
        component.id = id;
        return component;
    }
    component.setAttr = (key, value = '') => {
        component.setAttribute(key, value);
        return component;
    }
    component.rmAttr = (key) => {
        component.removeAttribute(key);
        return component;
    }
    component.toggleAttr = (key, condition) => {
        const bindable = unwrapBindable(condition);

        component
            .bind(bindable, newValue => {
                component.toggleAttribute(key, newValue);
            })
            .update(bindable);

        return component;
    }
    component.resetClasses = () => {
        component.className = '';
        return component;
    }
    component.removeFromClass = (className) => {
        component.classList.remove(className);
        return component;
    }
    component.addToClass = (className) => {
        component.classList.add(className);
        return component;
    }
    component.addToClassConditionally = (className, condition) => {
        const bindable = unwrapBindable(condition);

        component.bind(bindable, newValue => {
            component.classList.toggle(className, newValue);
        })
        .update(bindable);

        return component;
    }
    component.setStyle = (property, value) => {
        (component.style as any)[property] = value;
        return component;
    }

    component.setText = (text) => {
        const bindable = unwrapBindable(text);

        component
            .bind(bindable, newValue => {
                component.textContent = newValue;
            })
            .update(bindable);

        return component;
    }
    component.computeText = (object, compute) => {
        const bindable = unwrapBindable(object);

        component
            .bind(bindable, () => {
                const computedValue = compute(unwrapValue(object));
                component.textContent = computedValue;
            })
            .update(bindable);

        return component;
    }
    component.setHTML = (text) => {
        const bindable = unwrapBindable(text);

        component
            .bind(bindable, newValue => {
                component.innerHTML = newValue;
            })
            .update(bindable);

        return component;
    }
    component.computeHTML = (object, compute) => {
        const bindable = unwrapBindable(object);

        component
            .bind(bindable, newValue => {
                const computedValue = compute(unwrapValue(object));
                component.innerHTML = computedValue;
            })
            .update(bindable);

        return component;
    }

    component.listen = (eventName, handler) => {
        component.addEventListener(eventName, handler);
        return component;
    }
    component.ignore = (eventName, handler) => {
        component.addEventListener(eventName, handler);
        return component;
    }

    component.binders = new Map();
    component.bind = (bindable, responder) => {
        const binder = {
            uuid: UUID(),
            responder,
        };

        bindable.addBinder(binder);
        component.binders.set(bindable.uuid, binder)

        return component;
    }
    component.unbind = (bindable) => {
        const binder = component.binders.get(bindable.uuid);
        if (!binder) {
            console.error(`Failed to unbind ${bindable.uuid} but bindable is unknown.`);
            return component;
        }

        bindable.removeBinder(binder);
        component.binders.delete(bindable.uuid);

        return component;
    }
    component.update = (bindable) => {
        const binder = component.binders.get(bindable.uuid);
        if (!binder) {
            console.error(`Failed to update on bindable ${bindable.uuid} but bindable is unknown.`);
            return component;
        }

        bindable.triggerBinder(binder);

        return component;
    }

    return component;
}

// SPECIFIC