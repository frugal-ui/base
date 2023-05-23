import { UUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
export function UUID() {
    return uuidv4();
}

/* REACTIVITY */
// GENERAL
/** Object holding a value. Used by UI components. */
export type ValueObject<T> = T | BindableObject<T>;

/** Can be bound, no further functionality. Should be extended by classes. */
export class BindableObject<T> {
    uuid = UUID();
    _value: T;

    constructor(value: T) {
        this._value = value;
    }

    /* basic */
    get value() {
        return this._value;
    }

    set value(newValue: T) {
        this._value = newValue;
        this.triggerAll(defaultBindingConfig);
    }

    /* reactivity */
    triggerBinding(binding: Binding<T>) { }
    triggerAll(options: BindingConfig) { }
    addBinding(binding: Binding<T>) { }
    removeBinding(binding: Binding<T>) { }
}

/**  Can be bound, working with one item. Used by unwrapBindable(). */
export class BindableDummy<T> extends BindableObject<T> {
    action: BindingAction<T> | undefined;

    /* reactivity */
    triggerBinding() {
        if (this.action)
            this.action(this._value, defaultBindingConfig);
    }
    triggerAll() {
        if (this.action)
            this.action(this._value, defaultBindingConfig);
    }
    addBinding(binding: Binding<T>) {
        this.action = binding.action;
    }
}

/** Reactive Variable. Bindings will be triggered on change. */
export class State<T> extends BindableObject<T> {
    private bindings = new Map<Binding<T>['uuid'], Binding<T>['action']>();

    /* reactivity */
    triggerBinding(binding: Binding<T>) {
        binding.action(this.value, defaultBindingConfig);
    }
    triggerAll(options: BindingConfig) {
        this.bindings.forEach(action => {
            action(this.value, options);
        })
    }
    addBinding(binding: Binding<T>) {
        this.bindings.set(binding.uuid, binding.action);
    }
    removeBinding(binding: Binding<T>) {
        this.bindings.delete(binding.uuid);
    }
}

export interface BindingConfig {
    isSafeToPropagate: boolean;
}
export const defaultBindingConfig: BindingConfig = {
    isSafeToPropagate: true,
}
export type BindingAction<T> = (newValue: T, config: BindingConfig) => void;

/** Can be added to a BindableObject. */
export interface Binding<T> {
    uuid: string;
    action: BindingAction<T>;
}

/** Converts ValueObject to raw value. */
export function unwrapValue<T>(valueObject: ValueObject<T>): T {
    if (valueObject instanceof BindableObject) return valueObject.value;
    else return valueObject;
}
/** Converts ValueObject to BindableObject. */
export function unwrapBindable<T>(valueObject: ValueObject<T>): BindableObject<T> {
    if (valueObject instanceof BindableObject) return valueObject;
    else return new BindableDummy(unwrapValue(valueObject));
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
    /** Tracks bindings of the component. Key is BindableObject.uuid, value is the Binding. */
    bindings: Map<string, Binding<any>>;
    bind: <T>(bindable: BindableObject<T>, action: BindingAction<T>) => this;
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

    component.bindings = new Map();
    component.bind = (bindable, action) => {
        const binding = {
            uuid: UUID(),
            action,
        };

        bindable.addBinding(binding);
        component.bindings.set(bindable.uuid, binding)

        return component;
    }
    component.unbind = (bindable) => {
        const binding = component.bindings.get(bindable.uuid);
        if (!binding) {
            console.error(`Failed to unbind ${bindable.uuid} but bindable is unknown.`);
            return component;
        }

        bindable.removeBinding(binding);
        component.bindings.delete(bindable.uuid);

        return component;
    }
    component.update = (bindable) => {
        const binding = component.bindings.get(bindable.uuid);
        if (!binding) {
            console.error(`Failed to update on bindable ${bindable.uuid} but bindable is unknown.`);
            return component;
        }

        bindable.triggerBinding(binding);

        return component;
    }

    return component;
}

// SPECIFIC