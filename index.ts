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
    statesToBind: BindableObject<any>[];
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

        configuration.statesToBind.forEach(bindable => {
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

export interface TightBindingCfgOpts<T> {
    data: BindableObject<T>;
    component: Component<any>;
    fallbackValue: T;
    changeEventName: keyof HTMLElementEventMap;

    getViewProperty: () => T;
    setViewProperty: (newValue: T) => void;
}
/** Configure a binding for bi-directional changes. */
export class TightBindingCfg<T> {
    uuid = UUID();

    data: BindableObject<T>;
    component: Component<any>;
    defaultValue: T;
    changeEventName: keyof HTMLElementEventMap;

    constructor(configuration: TightBindingCfgOpts<T>) {
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

export interface ValueTBCfgOpts<T> {
    data: BindableObject<T>;
    component: Component<T>;
    fallbackValue: T;
}
/** Tightly binds a component's value. */
export class ValueTBCfg<T> extends TightBindingCfg<T> {
    constructor(configuration: ValueTBCfgOpts<T>) {
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

export interface CheckTBCfgOpts {
    isChecked: BindableObject<boolean>;
    component: CheckableComponent<any>;
}
/** Tightly bind a component's 'checked' property. */
export class CheckTBCfg extends ValueTBCfg<boolean> {
    component: CheckableComponent<any>;

    changeEventName: keyof HTMLElementEventMap = 'change';

    constructor(configuration: CheckTBCfgOpts) {
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

export interface SelectionCfg<T> {
    uuid: string;
    selectedItems: BindableObject<T[]>;
}

/** Add or remove ownValue on selectedItems */
export interface SelectionTBCfg<T> {
    selectionCfg: SelectionCfg<T>;
    ownValue: T;
    isExclusive: boolean;
    changeEventName: keyof HTMLElementEventMap;

    getIndex: () => number;

    getView: () => boolean;
    setView: (isSelected: boolean) => void;

    getModel: () => boolean;
    setModel: (isSelected: boolean) => void;
}

export interface CheckSelectionTBCfgOpts<T> {
    component: CheckableComponent<undefined>;
    value: T;
    selectionCfg: SelectionCfg<T>;
    isExclusive?: boolean;
}
/** SelectionCfg for checkable components */
export class CheckSelectionTBCfg<T> implements SelectionTBCfg<T> {
    component: CheckableComponent<undefined>;
    selectionCfg: SelectionCfg<T>;
    ownValue: T;
    isExclusive = false;
    changeEventName: keyof HTMLElementEventMap = 'change';

    constructor(configuration: CheckSelectionTBCfgOpts<T>) {
        this.component = configuration.component;
        this.selectionCfg = configuration.selectionCfg;
        this.ownValue = configuration.value;

        if (configuration.isExclusive) this.isExclusive = configuration.isExclusive;
    }

    getIndex = () => {
        return this.selectionCfg.selectedItems.value.indexOf(this.ownValue);
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
                return this.selectionCfg.selectedItems.value = [this.ownValue]
            else
                this.selectionCfg.selectedItems.value.push(this.ownValue);
        } else {
            if (this.getIndex() == -1) return; //already deselected
            this.selectionCfg.selectedItems.value.splice(this.getIndex(), 1);
        }

        this.selectionCfg.selectedItems.triggerAll();
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
    setAccessibilityRole: (roleName: string) => this;

    //children
    addItems: (...children: Component<any>[]) => this;
    addItemsBefore: (...children: Component<any>[]) => this;
    clear: () => this;
    setItems: (children: ValueObject<Component<any>[]>) => this;

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
    setValue: (value: ValueObject<ValueType>) => this;
    setHTML: (text: ValueObject<string>) => this;

    //events
    listen: (eventName: keyof HTMLElementEventMap, handler: ComponentEventHandler) => this;
    ignore: (eventName: keyof HTMLElementEventMap, handler: ComponentEventHandler) => this;

    //state
    /** Tracks bindings of the component. Key is BindableObject.uuid, value is the Binding. */
    bindings: Map<string, Binding<any>>;
    createBinding: <T>(bindable: BindableObject<T>, action: BindingAction<T>) => this;
    createSelectionBinding: <T>(viewModel: SelectionTBCfg<T>) => this;
    createTightBinding: <T>(viewModel: TightBindingCfg<T>) => this;
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
    component.setAccessibilityRole = (roleName) => {
        component.setAttr('role', roleName);
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
            .createBinding(bindable, children => {
                component
                    .clear()
                    .addItems(...children)
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
            .createBinding(bindable, newValue => {
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
            .createBinding(bindable, newValue => {
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

        component.createBinding(bindable, newValue => {
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
            .createBinding(bindable, newValue => {
                component.innerText = newValue;
            })
            .updateBinding(bindable);

        return component;
    }
    component.setValue = (value) => {
        const bindable = unwrapBindable(value);

        component
            .createBinding(bindable, newValue => {
                component.value = newValue;
            })
            .updateBinding(bindable);

        return component;
    }
    component.setHTML = (text) => {
        const bindable = unwrapBindable(text);

        component
            .createBinding(bindable, newValue => {
                component.innerHTML = newValue;
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
    component.createBinding = (bindable, action) => {
        const binding = {
            uuid: UUID(),
            action,
        };

        bindable.addBinding(binding);
        component.bindings.set(bindable.uuid, binding);

        return component;
    }
    component.createTightBinding = (configuration) => {
        component
            .createBinding(configuration.data, newValue => {
                configuration.setViewProperty(newValue);
            })
            .updateBinding(configuration.data)
            .listen(configuration.changeEventName, () => {
                configuration.data.value = configuration.getViewProperty();
            });

        return component;
    }
    component.createSelectionBinding = (configuration) => {
        component
            .createBinding(configuration.selectionCfg.selectedItems, () => {
                const isSelected = configuration.getIndex() != -1;
                configuration.setView(isSelected);
            })
            .updateBinding(configuration.selectionCfg.selectedItems)
            .listen(configuration.changeEventName, () => {
                const isSelectedInView = configuration.getView();
                configuration.setModel(isSelectedInView);
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
/* AutoComplete */
export function AutoComplete<T>(optionData: BindableObject<string[]>, input: Component<T>) {
    const uuid = UUID();
    const optionViews = new ComputedState<Component<any>[]>({
        statesToBind: [optionData],
        initialValue: [],
        compute: (self) => {
            self.value = optionData.value.map(option =>
                Text(option, 'option')
            );
        }
    });

    return Div(
        Component('datalist')
            .setID(uuid)
            .setItems(optionViews),

        input
            .setAttr('list', uuid),
    );
}

/* Box */
export function Box(...children: Component<any>[]) {
    return Div(...children)
        .addToClass('boxes');
}

/* Button */
export enum ButtonStyles {
    Transparent = 'buttons-transparent',
    Normal = 'buttons-normal',
    Primary = 'buttons-primary',
    Destructive = 'buttons-destructive',
}

export interface ButtonCfg {
    style?: ButtonStyles;
    text?: ValueObject<string>;
    iconName?: string;
    accessibilityLabel: ValueObject<string>;
    action: (e: Event) => void;
}

export function Button(viewModel: ButtonCfg) {
    return Component('button')
        .addItems(
            Icon(viewModel.iconName ?? ''),
            Text(viewModel.text ?? ''),
        )

        .setAttr('aria-label', viewModel.accessibilityLabel)
        .addToClass(viewModel.style ?? ButtonStyles.Normal)

        .listen('click', viewModel.action);
}

/* ButtonGroup */
export function ButtonGroup(...buttons: Component<any>[]) {
    return Div(...buttons)
        .addToClass('buttongroups');
}

/* Checkbox */
export function Checkbox(isChecked: BindableObject<boolean>, isIndeterminate?: BindableObject<boolean>) {
    return (Input({
        type: 'checkbox',
        fallbackValue: undefined,
        value: undefined,
        placeholder: undefined,
    }) as CheckableComponent<undefined>)
        .access(self => {
            self.createTightBinding(new CheckTBCfg({
                isChecked: isChecked,
                component: self,
            }))

            if (isIndeterminate != undefined)
                self.createTightBinding(new TightBindingCfg<boolean>({
                    component: self,
                    data: isIndeterminate,
                    fallbackValue: false,
                    changeEventName: 'change',

                    getViewProperty: () => (self as any).indeterminate,
                    setViewProperty: (newValue) => (self as any).indeterminate = newValue,
                }));
        });
}

/* Container */
export function Container(tagName: keyof HTMLElementTagNameMap, ...children: Component<any>[]) {
    return Component(tagName)
        .addItems(...children);
}

export function Div(...children: Component<any>[]) {
    return Container('div', ...children);
}

/* HStack */
export function HStack(...children: Component<any>[]) {
    return Div(...children)
        .addToClass('stacks-horizontal');
}

/* Icon */
export function Icon(iconName: string) {
    return Text(iconName)
        .addToClass('icons'); //TODO
}

/* Input */
export interface InputCfg<T> {
    type: string;
    value: BindableObject<T> | undefined;
    fallbackValue: T | undefined;
    placeholder?: string | undefined;
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
                .createTightBinding(new ValueTBCfg({
                    data: configuration.value,
                    component: self,
                    fallbackValue: configuration.fallbackValue,
                }));
        });
}

/* Label */
export function Label(labelText: string, labeledItem: Component<any>) {
    return Component('label')
        .setText(labelText)
        .addItems(labeledItem);
}

/* Link */
export function Link(label: ValueObject<string>, href: string) {
    return Text(label, 'a')
        .setAttr('href', href);
}

/* List */
export function List<T>(listData: BindableObject<T[]>, compute: (itemData: T) => Component<any>) {
    const itemViews = new ComputedState<Component<any>[]>({
        statesToBind: [listData],
        initialValue: [],
        compute: (self) => {
            self.value = listData.value.map(item =>
                compute(item)
            );
        },
    })

    return Div()
        .setItems(itemViews);
}

/* ListBox */
export function ListBox<T>(listData: BindableObject<T[]>, compute: (itemData: T) => Component<any>) {
    return Box(
        List(listData, compute)
            .setAccessibilityRole('listbox')
    );
}

/* ListItem */
export function ListItem(isHighlighted: ValueObject<boolean>, ...children: Component<any>[]) {
    const bindableIsHighlighted = unwrapBindable(isHighlighted);

    return Div(...children)
        .access(self => self
            .addToClass('listitems')
            .createBinding(bindableIsHighlighted, () => self
                .addToClassConditionally('listitems-highlighted', bindableIsHighlighted.value)
                .setAttr('aria-selected', bindableIsHighlighted.value.toString())
            )
            .setAccessibilityRole('option')
        )
}

/* Meter */
export interface MeterOpts {
    min?: number,
    max?: number,
    low?: number;
    high?: number;
}

export function Meter(value: BindableObject<number>, options: MeterOpts = {}) {
    const min = options.min ?? 0;
    const max = options.max ?? 1;
    const low = options.low ?? min;
    const high = options.high ?? max;

    return Component<number>('meter')
        .setValue(value)

        .setAttr('min', min.toString())
        .setAttr('max', max.toString())
        .setAttr('low', low.toString())
        .setAttr('high', high.toString());
}

/* ProgressBar */
export enum ProgressBarStates {
    Normal,
    Indeterminate,
}

export function ProgressBar(value: BindableObject<number>, state: BindableObject<ProgressBarStates>) {
    return Component<number>('progress')
        .setValue(value)
        .access(self => self
            .createBinding(state, state => {
                const isIndeterminate = state == ProgressBarStates.Indeterminate;
                if (isIndeterminate) self.rmAttr('value');
                else self.value = value.value;
            })
            .updateBinding(state),
        );
}

/* RadioButton */
export function RadioButton<T>(selectionCfg: SelectionCfg<T>, value: T) {
    return (Input({
        type: 'radio',
        fallbackValue: undefined,
        value: undefined,
        placeholder: undefined,
    }) as CheckableComponent<undefined>)
        .access(self => self
            .createSelectionBinding(new CheckSelectionTBCfg({
                selectionCfg,
                component: self,
                value: value,
                isExclusive: true,
            }))
        )
        .setAttr('name', selectionCfg.uuid);
}

/* Select */
export interface SelectOption {
    label: string,
    value: string,
}

export function Select(value: BindableObject<string>, options: BindableObject<SelectOption[]>) {
    const optionViews = new ComputedState<Component<any>[]>({
        statesToBind: [options],
        initialValue: [],
        compute: (self) => {
            self.value = options.value.map(option =>
                Text(option.label, 'option')
                    .setValue(option.value)
            );
        }
    })

    return Component('select')
        .setItems(optionViews)
        .access(self => self
            .createTightBinding(new ValueTBCfg({
                component: self,
                data: value,
                fallbackValue: '',
            }))
        )
}

/* Separator */
export function Separator() {
    return Component('hr');
}

/* Slider */
export interface SliderOpts {
    min?: number;
    max?: number;
    step?: number;
}

export function Slider(value: BindableObject<number>, options: SliderOpts = {}) {
    return Input<number>({
        type: 'range',
        fallbackValue: 0,
        value,
        placeholder: undefined,
    })
        .access(self => self
            .setAttr('min', (options.min ?? 0).toString())
            .setAttr('max', (options.max ?? 100).toString())
            .setAttr('step', (options.step ?? 1).toString())
        )
}

/* Text */
export function Text(value: ValueObject<string>, tagName: keyof HTMLElementTagNameMap = 'span') {
    return Component(tagName)
        .setText(value);
}

/* Textarea */
export function Textarea(value: BindableObject<string>, placeholder: string) {
    return Component<string>('textarea')
        .access(self => self
            .createTightBinding(new ValueTBCfg({
                component: self,
                data: value,
                fallbackValue: '',
            }))

            .setAttr('placeholder', placeholder),
        );
}

/* Toggle */
export function Toggle(isChecked: BindableObject<boolean>) {
    return Checkbox(isChecked)
        .addToClass('toggles');
}

/* VStack */
export function VStack(...children: Component<any>[]) {
    return Div(...children)
        .addToClass('stacks-vertical');
}