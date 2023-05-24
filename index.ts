import { UUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
export function UUID() {
    return uuidv4();
}

/*
    GENERAL
*/
export type ViewModel = { [key: string]: any };

/* 
    REACTIVITY 
*/
// VALUE
/** Object holding a value. Used by UI components. */
export type ValueObject<T> = T | BindableObject<T>;

// BINDABLE
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
        this.triggerAll(defaultBindingDetails);
    }

    /* reactivity */
    triggerBinding(binding: Binding<T>) { }
    triggerAll(options?: BindingDetails) { }
    addBinding(binding: Binding<T>) { }
    removeBinding(binding: Binding<T>) { }
}

/**  Can be bound, working with one item. Used by unwrapBindable(). */
export class BindableDummy<T> extends BindableObject<T> {
    action: BindingAction<T> | undefined;

    /* reactivity */
    triggerBinding() {
        if (this.action)
            this.action(this._value, defaultBindingDetails);
    }
    triggerAll() {
        if (this.action)
            this.action(this._value, defaultBindingDetails);
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
        binding.action(this.value, defaultBindingDetails);
    }
    triggerAll(options: BindingDetails = defaultBindingDetails) {
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

export class ComputedState<T> extends State<T> {
    constructor(bindables: BindableObject<any>[], initialValue: T, compute: (self: ComputedState<T>) => void) {
        super(initialValue);

        bindables.forEach(bindable => {
            bindable.addBinding({
                uuid: UUID(),
                action: () => compute(this),
            });
        });
    }
}

// BINDING
/** Can be added to a BindableObject. */
export interface Binding<T> {
    uuid: string;
    action: BindingAction<T>;
}

/** Action executed when bound object changes. */
export type BindingAction<T> = (newValue: T, details: BindingDetails) => void;

export interface BindingDetails extends ViewModel {
    isSafeToPropagate: boolean;
}

export const defaultBindingDetails: BindingDetails = {
    isSafeToPropagate: true,
}

export interface SelectionBindingVM<T> extends BindingDetails {
    bindable: BindableObject<T[]>;
    value: T;
    exclusive: boolean;
    eventName: keyof HTMLElementEventMap;

    getView: () => boolean;
    setView: (isSelected: boolean) => void;

    getModel: () => boolean;
    setModel: (isSelected: boolean) => void;
}

export class CheckableSelectionBindingVM<T> implements SelectionBindingVM<T> {
    component: CheckableComponent<undefined>;

    isSafeToPropagate = true;
    bindable: BindableObject<T[]>;
    value: T;
    exclusive = false;
    eventName: keyof HTMLElementEventMap = 'change';

    constructor(component: CheckableComponent<undefined>, value: T, bindable: BindableObject<T[]>, exclusive?: boolean) {
        this.component = component;
        this.bindable = bindable;
        this.value = value;

        if (exclusive) this.exclusive = exclusive;
    }

    getView = () => {
        return this.component.checked;
    }
    setView = (isSelected: boolean) => {
        this.component.checked = isSelected;
    }

    private getIndex = () => {
        return this.bindable.value.indexOf(this.value);
    }
    getModel = () => {
        return this.getIndex() != -1;
    }
    setModel = (isSelected: boolean) => {
        if (isSelected) {
            if (this.getIndex() != -1) return; //already selected

            if (this.exclusive == true)
                return this.bindable.value = [this.value]
            else
                this.bindable.value.push(this.value);
        } else {
            if (this.getIndex() == -1) return; //already deselected
            this.bindable.value.splice(this.getIndex(), 1);
        }

        this.bindable.triggerAll();
    }
}

export interface TwoWayBindingVM<T> extends BindingDetails {
    bindable: BindableObject<T>,
    getViewProperty: () => T,
    setViewProperty: (newValue: T) => void,
    eventName: keyof HTMLElementEventMap,
}

export class InputTwoWayBindingVM<T> implements TwoWayBindingVM<T> {
    isSafeToPropagate = true;
    bindable: BindableObject<T>;

    component: Component<T>;
    defaultValue: T;

    eventName: keyof HTMLElementEventMap = 'input';

    constructor(component: Component<T>, bindable: BindableObject<T>, defaultValue: T) {
        this.bindable = bindable;
        this.component = component;
        this.defaultValue = defaultValue;
    }

    getViewProperty = () => {
        return this.component.value ?? this.defaultValue;
    }
    setViewProperty = (newValue: T) => {
        this.component.value = newValue;
    }
}

export class CheckableTwoWayBindingVM extends InputTwoWayBindingVM<boolean> {
    component: CheckableComponent<any>;

    eventName: keyof HTMLElementEventMap = 'change';

    constructor(component: CheckableComponent<any>, bindable: BindableObject<boolean>) {
        super(component, bindable, false);
        this.component = component;
    }

    getViewProperty = () => {
        return this.component.checked;
    }
    setViewProperty = (newValue: boolean) => {
        this.component.checked = newValue
    }
}

// HELPERS
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

/* 
    COMPONENTS 
*/
// GENERAL
export type ComponentEventHandler = (this: HTMLElement, e: Event) => void;

/** UI Component. */
export interface Component<ValueType> extends HTMLElement {
    value: ValueType | undefined,
    access: (accessFn: (self: this) => void) => this;

    //children
    addItems: (...children: Component<any>[]) => this;
    addItemsBefore: (...children: Component<any>[]) => this;
    clear: () => this;
    setItems: (children: ValueObject<Component<any>[]>) => this;
    computeItems: <T>(object: ValueObject<T>, compute: (unwrappedObject: T) => Component<any>[]) => this;

    //attributes
    setID: (id: string) => this;
    setAttr: (key: string, value?: ValueObject<string>) => this;
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

    setValue: (value: ValueObject<ValueType>) => this;
    /** Passes unwrapped value into compute() function. Result of compute() will be textContent. */
    computeValue: <T>(object: ValueObject<T>, compute: (unwrappedObject: T) => ValueType) => this;

    setHTML: (text: ValueObject<string>) => this;
    /** Passes unwrapped value into compute() function. Result of compute() will be innerHTML. */
    computeHTML: <T>(object: ValueObject<T>, compute: (unwrappedObject: T) => string) => this;

    //events
    listen: (eventName: keyof HTMLElementEventMap, handler: ComponentEventHandler) => this;
    ignore: (eventName: keyof HTMLElementEventMap, handler: ComponentEventHandler) => this;

    //state
    /** Tracks bindings of the component. Key is BindableObject.uuid, value is the Binding. */
    bindings: Map<string, Binding<any>>;
    addBinding: <T>(bindable: BindableObject<T>, action: BindingAction<T>) => this;
    createSelectionBinding: <T>(viewModel: SelectionBindingVM<T>) => this;
    createTwoWayBinding: <T>(viewModel: TwoWayBindingVM<T>) => this;
    removeBinding: <T>(bindable: BindableObject<T>) => this;
    updateBinding: <T>(bindable: BindableObject<T>) => this;
}

export interface CheckableComponent<T> extends Component<T> {
    checked: boolean;
}

export function Component<ValueType>(tagName: keyof HTMLElementTagNameMap): Component<ValueType> {
    //create
    const component = document.createElement(tagName) as Component<ValueType>;

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
    component.clear = () => {
        component.innerHTML = '';
        return component;
    }
    component.setItems = (children) => {
        const bindable = unwrapBindable(children);

        component
            .addBinding(bindable, children => {
                component
                    .clear()
                    .addItems(...children)
            })
            .updateBinding(bindable);

        return component;
    }
    component.computeItems = (object, compute) => {
        const bindable = unwrapBindable(object);

        component
            .addBinding(bindable, object => {
                component
                    .clear()
                    .addItems(
                        ...compute(object)
                    )
            })
            .updateBinding(bindable);

        return component;
    }

    component.setID = (id) => {
        component.id = id;
        return component;
    }
    component.setAttr = (key, value = '') => {
        const bindable = unwrapBindable(value);

        component
            .addBinding(bindable, newValue => {
                component.setAttribute(key, newValue);
            })
            .updateBinding(bindable);

        return component;
    }
    component.rmAttr = (key) => {
        component.removeAttribute(key);
        return component;
    }
    component.toggleAttr = (key, condition) => {
        const bindable = unwrapBindable(condition);

        component
            .addBinding(bindable, newValue => {
                component.toggleAttribute(key, newValue);
            })
            .updateBinding(bindable);

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

        component.addBinding(bindable, newValue => {
            component.classList.toggle(className, newValue);
        })
            .updateBinding(bindable);

        return component;
    }
    component.setStyle = (property, value) => {
        (component.style as any)[property] = value;
        return component;
    }

    component.setText = (text) => {
        const bindable = unwrapBindable(text);

        component
            .addBinding(bindable, newValue => {
                component.textContent = newValue;
            })
            .updateBinding(bindable);

        return component;
    }
    component.computeText = (object, compute) => {
        const bindable = unwrapBindable(object);

        component
            .addBinding(bindable, () => {
                const computedValue = compute(unwrapValue(object));
                component.textContent = computedValue;
            })
            .updateBinding(bindable);

        return component;
    }
    component.setValue = (value) => {
        const bindable = unwrapBindable(value);

        component
            .addBinding(bindable, newValue => {
                component.value = newValue;
            })
            .updateBinding(bindable);

        return component;
    }
    component.computeValue = (object, compute) => {
        const bindable = unwrapBindable(object);

        component
            .addBinding(bindable, () => {
                const computedValue = compute(unwrapValue(object));
                component.value = computedValue;
            })
            .updateBinding(bindable);

        return component;
    }
    component.setHTML = (text) => {
        const bindable = unwrapBindable(text);

        component
            .addBinding(bindable, newValue => {
                component.innerHTML = newValue;
            })
            .updateBinding(bindable);

        return component;
    }
    component.computeHTML = (object, compute) => {
        const bindable = unwrapBindable(object);

        component
            .addBinding(bindable, newValue => {
                const computedValue = compute(unwrapValue(object));
                component.innerHTML = computedValue;
            })
            .updateBinding(bindable);

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
    component.addBinding = (bindable, action) => {
        const binding = {
            uuid: UUID(),
            action,
        };

        bindable.addBinding(binding);
        component.bindings.set(bindable.uuid, binding);

        return component;
    }
    component.createSelectionBinding = (viewModel) => {
        component
            .addBinding(viewModel.bindable, () => {
                const isSelected = viewModel.getIndex() != -1;
                viewModel.setView(isSelected);
            })
            .updateBinding(viewModel.bindable)
            .listen(viewModel.eventName, () => {
                const isSelectedInView = viewModel.getView();
                viewModel.setModel(isSelectedInView);
            });

        return component;
    }
    component.createTwoWayBinding = (viewModel) => {
        component
            .addBinding(viewModel.bindable, newValue => {
                viewModel.setViewProperty(newValue);
            })
            .updateBinding(viewModel.bindable)
            .listen(viewModel.eventName, () => {
                viewModel.bindable.value = viewModel.getViewProperty();
            });

        return component;
    }
    component.removeBinding = (bindable) => {
        const binding = component.bindings.get(bindable.uuid);
        if (!binding) {
            console.error(`Failed to unbind ${bindable.uuid} but bindable is unknown.`);
            return component;
        }

        bindable.removeBinding(binding);
        component.bindings.delete(bindable.uuid);

        return component;
    }
    component.updateBinding = (bindable) => {
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
/* Button */
export enum ButtonStyles {
    Transparent = 'button-style-transparent',
    Normal = 'button-style-normal',
    Primary = 'button-style-primary',
    Destructive = 'button-style-destructive',
}

export interface ButtonVM extends ViewModel {
    style: ButtonStyles;
    text: ValueObject<string>;
    iconName: string;
    ariaLabel: ValueObject<string>;
    action: (e: Event) => void;
}

export class TextualButtonVM implements ButtonVM {
    style = ButtonStyles.Normal;
    text: ValueObject<string>;
    iconName = '';
    ariaLabel: ValueObject<string>;
    action = (e: Event) => console.warn('Button action not defined', e.target);

    constructor(text: ButtonVM['text'], action?: ButtonVM['action'], style?: ButtonVM['style']) {
        this.text = text;
        this.ariaLabel = text;
        if (style) this.style = style;
        if (action) this.action = action;
    }
}

export function Button(viewModel: ButtonVM) {
    return Component('button')
        .addItems(
            Icon(viewModel.iconName),
            Text(viewModel.text),
        )

        .setAttr('aria-label', viewModel.ariaLabel)
        .addToClass(viewModel.style)

        .listen('click', viewModel.action);
}

/* Checkbox */
export function Checkbox(bindable: BindableObject<string[]>, value: string) {
    return (Input({
        type: 'checkbox',
        defaultValue: undefined,
        value: undefined,
    }) as CheckableComponent<undefined>)
        .access(self => self
            .createSelectionBinding(new CheckableSelectionBindingVM(
                self, value, bindable, false
            ))
        );
}

/* Icon */
export function Icon(iconName: string) {
    return Text(iconName)
        .addToClass('icon'); //TODO
}

/* Input */
export interface InputVM<T> {
    type: string;
    defaultValue: T | undefined;
    value: BindableObject<T> | undefined;
}

export class TextInputVM implements InputVM<string> {
    type = 'text';
    defaultValue: string;
    value: BindableObject<string>;

    constructor(value: BindableObject<string>) {
        this.defaultValue = value.value;
        this.value = value;
    }
}

export class NumberInputVM implements InputVM<number> {
    type = 'number';
    defaultValue: number;
    value: BindableObject<number>;

    constructor(value: BindableObject<number>) {
        this.defaultValue = value.value;
        this.value = value;
    }
}

export function Input<T>(viewModel: InputVM<T>) {
    return Component<T>('input')
        .access(self => {
            self.setAttr('type', viewModel.type);

            if (viewModel.value != undefined && viewModel.defaultValue != undefined) self
                .createTwoWayBinding(new InputTwoWayBindingVM(self, viewModel.value, viewModel.defaultValue));
        });
}

/* RadioButton */
export function RadioButton(bindable: BindableObject<number[]>, ownIndex: number, name: string) {
    return (Input({
        type: 'radio',
        defaultValue: undefined,
        value: undefined,
    }) as CheckableComponent<undefined>)
        .access(self => self
            .createSelectionBinding(new CheckableSelectionBindingVM(
                self, ownIndex, bindable, true
            ))
        )
        .setAttr('name', name);
}

/* Slider */
export function Slider(value: BindableObject<number>, min: number = 0, max: number = 100, step: number = 1) {
    return Input<number>({
        type: 'range',
        defaultValue: 0,
        value,
    })
        .access(self => self
            .setAttr('min', min.toString())
            .setAttr('max', max.toString())
            .setAttr('step', step.toString())
        )
}

/* Text */
export function Text(value: ValueObject<string>, tagName: keyof HTMLElementTagNameMap = 'span') {
    return Component(tagName)
        .setText(value);
}