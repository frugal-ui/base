import { UUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
export function UUID() {
    return uuidv4();
}

/*
    GENERAL
*/
export class DataModel {
    readonly uuid = UUID();
}

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
        this.triggerAll();
    }

    /* reactivity */
    triggerBinding(binding: Binding<T>) { }
    triggerAll() { }
    addBinding(binding: Binding<T>) { }
    removeBinding(binding: Binding<T>) { }
}

/**  Can be bound, working with one item. Used by unwrapBindable(). */
export class BindableDummy<T> extends BindableObject<T> {
    action: BindingAction<T> | undefined;

    /* reactivity */
    triggerBinding() {
        if (this.action)
            this.action(this._value);
    }
    triggerAll() {
        if (this.action)
            this.action(this._value);
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
        binding.action(this.value);
    }
    triggerAll() {
        this.bindings.forEach(action => {
            action(this.value);
        })
    }
    addBinding(binding: Binding<T>) {
        this.bindings.set(binding.uuid, binding.action);
    }
    removeBinding(binding: Binding<T>) {
        this.bindings.delete(binding.uuid);
    }
}

export interface ComputedStateCfg<T> {
    bindables: BindableObject<any>[];
    initialValue: T;
    compute: (self: ComputedState<T>) => void;
}
/** State binding another state. Mono-directional. */
export class ComputedState<T> extends State<T> {
    constructor(configuration: ComputedStateCfg<T>) {
        super(configuration.initialValue);

        const binding = {
            uuid: UUID(),
            action: () => configuration.compute(this),
        }

        configuration.bindables.forEach(bindable => {
            bindable.addBinding(binding);
            bindable.triggerBinding(binding);
        });
    }
}

export interface ProxyStateCfg<T, O> {
    original: BindableObject<O>;
    convertFromOriginal: (originalValue: O) => T;
    convertToOriginal: (value: T) => O;
}
/** State binding and updating another state. Bi-directional. */
export class ProxyState<T, O> extends State<T> {
    original: BindableObject<O>;
    convertFromOriginal: (proxyValue: O) => T;
    convertToOriginal: (proxyValue: T) => O;

    constructor(configuration: ProxyStateCfg<T, O>) {
        super(configuration.convertFromOriginal(configuration.original.value));

        this.original = configuration.original;
        this.convertFromOriginal = configuration.convertFromOriginal;
        this.convertToOriginal = configuration.convertToOriginal;

        const binding: Binding<O> = {
            uuid: UUID(),
            action: () => {
                this._value = configuration.convertFromOriginal(this.original.value);
                this.triggerAll();
            },
        }
        this.original.addBinding(binding);
        this.original.triggerBinding(binding);
    }

    set value(newValue: T) {
        this._value = newValue;
        this.original.value = this.convertToOriginal(this.value);
    }

    get value() {
        return this._value;
    }
}

// BINDING
/** Binds a BindableObject. */
export interface Binding<T> {
    uuid: string;
    action: BindingAction<T>;
}

/** Action executed when bound object changes. */
export type BindingAction<T> = (newValue: T) => void;

export interface UIBindingCfgOpts<T> {
    data: BindableObject<T>;
    component: Component<T>;
    fallbackValue: T;
    changeEventName: keyof HTMLElementEventMap;

    getViewProperty: () => T;
    setViewProperty: (newValue: T) => void;
}
/** Configure a binding for bi-directional changes. */
export class UIBindingCfg<T> {
    data: BindableObject<T>;
    component: Component<T>;
    defaultValue: T;
    changeEventName: keyof HTMLElementEventMap;

    constructor(configuration: UIBindingCfgOpts<T>) {
        this.data = configuration.data;
        this.component = configuration.component;
        this.defaultValue = configuration.fallbackValue;
        this.changeEventName = configuration.changeEventName;

        this.getViewProperty = configuration.getViewProperty;
        this.setViewProperty = configuration.setViewProperty;
    }

    getViewProperty: () => T;
    setViewProperty: (newValue: T) => void;
}

export interface UIValueCfgOpts<T> {
    data: BindableObject<T>;
    component: Component<T>;
    fallbackValue: T;
}
/** Tightly binds a component's value. */
export class UIValueCfg<T> extends UIBindingCfg<T> {
    constructor(configuration: UIValueCfgOpts<T>) {
        super({
            data: configuration.data,
            component: configuration.component,
            fallbackValue: configuration.fallbackValue,
            changeEventName: 'input',

            getViewProperty: () => {
                return this.component.value ?? this.defaultValue;
            },
            setViewProperty: (newValue: T) => {
                this.component.value = newValue;
            },
        })
    }
}

export interface UICheckCfgOpts {
    isChecked: BindableObject<boolean>;
    component: CheckableComponent<any>;
}
/** Tightly bind a component's 'checked' property. */
export class UICheckCfg extends UIValueCfg<boolean> {
    component: CheckableComponent<any>;

    changeEventName: keyof HTMLElementEventMap = 'change';

    constructor(configuration: UICheckCfgOpts) {
        super({
            data: configuration.isChecked,
            component: configuration.component,
            fallbackValue: false,
        })
        this.component = configuration.component;
    }

    getViewProperty = () => {
        return this.component.checked;
    }
    setViewProperty = (newValue: boolean) => {
        this.component.checked = newValue
    }
}

/** Add or remove ownValue on selectedItems */
export interface UISelectionCfg<T> {
    selectedItems: BindableObject<T[]>;
    ownValue: T;
    isExclusive: boolean;
    changeEventName: keyof HTMLElementEventMap;

    getIndex: () => number;

    getView: () => boolean;
    setView: (isSelected: boolean) => void;

    getModel: () => boolean;
    setModel: (isSelected: boolean) => void;
}

export interface UICheckSelectionCfgOpts<T> {
    component: CheckableComponent<undefined>;
    value: T;
    bindable: BindableObject<T[]>;
    isExclusive?: boolean;
}
/** SelectionCfg for checkable components */
export class UICheckSelectionCfg<T> implements UISelectionCfg<T> {
    isSafeToPropagate = true;

    component: CheckableComponent<undefined>;
    selectedItems: BindableObject<T[]>;
    ownValue: T;
    isExclusive = false;
    changeEventName: keyof HTMLElementEventMap = 'change';

    constructor(configuration: UICheckSelectionCfgOpts<T>) {
        this.component = configuration.component;
        this.selectedItems = configuration.bindable;
        this.ownValue = configuration.value;

        if (configuration.isExclusive) this.isExclusive = configuration.isExclusive;
    }

    getIndex = () => {
        return this.selectedItems.value.indexOf(this.ownValue);
    }

    getView = () => {
        return this.component.checked;
    }
    setView = (isSelected: boolean) => {
        this.component.checked = isSelected;
    }

    getModel = () => {
        return this.getIndex() != -1;
    }
    setModel = (isSelected: boolean) => {
        if (isSelected) {
            if (this.getIndex() != -1) return; //already selected

            if (this.isExclusive == true)
                return this.selectedItems.value = [this.ownValue]
            else
                this.selectedItems.value.push(this.ownValue);
        } else {
            if (this.getIndex() == -1) return; //already deselected
            this.selectedItems.value.splice(this.getIndex(), 1);
        }

        this.selectedItems.triggerAll();
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
    createSelectionBinding: <T>(viewModel: UISelectionCfg<T>) => this;
    createTwoWayBinding: <T>(viewModel: UIBindingCfg<T>) => this;
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
            .addBinding(viewModel.selectedItems, () => {
                const isSelected = viewModel.getIndex() != -1;
                viewModel.setView(isSelected);
            })
            .updateBinding(viewModel.selectedItems)
            .listen(viewModel.changeEventName, () => {
                const isSelectedInView = viewModel.getView();
                viewModel.setModel(isSelectedInView);
            });

        return component;
    }
    component.createTwoWayBinding = (viewModel) => {
        component
            .addBinding(viewModel.data, newValue => {
                viewModel.setViewProperty(newValue);
            })
            .updateBinding(viewModel.data)
            .listen(viewModel.changeEventName, () => {
                viewModel.data.value = viewModel.getViewProperty();
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

export interface ButtonCfg {
    style: ButtonStyles;
    text: ValueObject<string>;
    iconName: string;
    ariaLabel: ValueObject<string>;
    action: (e: Event) => void;
}

export class TextualButtonCfg implements ButtonCfg {
    style = ButtonStyles.Normal;
    text: ValueObject<string>;
    iconName = '';
    ariaLabel: ValueObject<string>;
    action = (e: Event) => console.warn('Button action not defined', e.target);

    constructor(text: ButtonCfg['text'], action?: ButtonCfg['action'], style?: ButtonCfg['style']) {
        this.text = text;
        this.ariaLabel = text;
        if (style) this.style = style;
        if (action) this.action = action;
    }
}

export function Button(viewModel: ButtonCfg) {
    return Component('button')
        .addItems(
            Icon(viewModel.iconName),
            Text(viewModel.text),
        )

        .setAttr('aria-label', viewModel.ariaLabel)
        .addToClass(viewModel.style)

        .listen('click', viewModel.action);
}

/* ButtonGroup */
export function ButtonGroup(...buttons: Component<any>[]) {
    return Div(...buttons)
        .addToClass('buttongroup');
}

/* Checkbox */
export function Checkbox(isChecked: BindableObject<boolean>) {
    return (Input({
        type: 'checkbox',
        fallbackValue: undefined,
        value: undefined,
        placeholder: undefined,
    }) as CheckableComponent<undefined>)
        .access(self => self
            .createTwoWayBinding(new UICheckCfg({
                isChecked: isChecked,
                component: self,
            }))
        );
}

/* Container */
export function Container(tagName: keyof HTMLElementTagNameMap, ...children: Component<any>[]) {
    return Component(tagName)
        .addItems(...children);
}

export function Div(...children: Component<any>[]) {
    return Container('div', ...children);
}

/* Icon */
export function Icon(iconName: string) {
    return Text(iconName)
        .addToClass('icon'); //TODO
}

/* Input */
export interface InputCfg<T> {
    type: string;
    value: BindableObject<T> | undefined;
    fallbackValue: T | undefined;
    placeholder: string | undefined;
}

export class TextInputCfg implements InputCfg<string> {
    type = 'text';
    value: BindableObject<string>;
    fallbackValue: string;
    placeholder: string;

    constructor(value: BindableObject<string>, placeholder = '') {
        this.fallbackValue = value.value;
        this.value = value;
        this.placeholder = placeholder;
    }
}

export class NumberInputCfg implements InputCfg<number> {
    type = 'number';
    value: BindableObject<number>;
    fallbackValue: number;
    placeholder: string;

    constructor(value: BindableObject<number>, placeholder = '') {
        this.fallbackValue = value.value;
        this.value = value;
        this.placeholder = placeholder;
    }
}

export function Input<T>(configuration: InputCfg<T>) {
    return Component<T>('input')
        .access(self => {
            self
                .setAttr('type', configuration.type)
                .setAttr('placeholder', configuration.placeholder ?? '');

            if (configuration.value != undefined && configuration.fallbackValue != undefined) self
                .createTwoWayBinding(new UIValueCfg({
                    data: configuration.value,
                    component: self,
                    fallbackValue: configuration.fallbackValue,
                }));
        });
}

/* Link */
export function Link(label: ValueObject<string>, href: string) {
    return Text(label, 'a')
        .setAttr('href', href);
}

/* RadioButton */
export function RadioButton<T>(selectionOptions: BindableObject<T[]>, ownIndex: T, name: string) {
    return (Input({
        type: 'radio',
        fallbackValue: undefined,
        value: undefined,
        placeholder: undefined,
    }) as CheckableComponent<undefined>)
        .access(self => self
            .createSelectionBinding(new UICheckSelectionCfg({
                bindable: selectionOptions,
                component: self,
                value: ownIndex,
            }))
        )
        .setAttr('name', name);
}

/* Slider */
export interface SliderCfgExt {
    min?: number;
    max?: number;
    step?: number;
}

export function Slider(value: BindableObject<number>, configurationExtension: SliderCfgExt) {
    return Input<number>({
        type: 'range',
        fallbackValue: 0,
        value,
        placeholder: undefined,
    })
        .access(self => self
            .setAttr('min', (configurationExtension.min ?? 0).toString())
            .setAttr('max', (configurationExtension.max ?? 100).toString())
            .setAttr('step', (configurationExtension.step ?? 1).toString())
        )
}

/* Text */
export function Text(value: ValueObject<string>, tagName: keyof HTMLElementTagNameMap = 'span') {
    return Component(tagName)
        .setText(value);
}