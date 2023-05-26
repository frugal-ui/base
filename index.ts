import { v4 as uuidv4 } from 'uuid';
export function UUID() {
	return uuidv4();
}

import './styles/base.css';
import './styles/color.css';
import './styles/theme.css';

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
		if (this.action) this.action(this._value);
	}
	triggerAll() {
		if (this.action) this.action(this._value);
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
		this.bindings.forEach((action) => {
			action(this.value);
		});
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
		};

		configuration.statesToBind.forEach((bindable) => {
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
		};
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
		});
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
		});
		this.component = configuration.component;
	}

	getViewProperty = () => {
		return this.component.checked;
	};
	setViewProperty = (newValue: boolean) => {
		this.component.checked = newValue;
	};
}

export interface DataSelectionCfg<T> {
	uuid: string;
	selectedItems: BindableObject<T[]>;
}

export interface ViewItemSelectionCfgOpts<T> {
	component: Component<any>;
	ownValue: T;
	selectionCfg: DataSelectionCfg<T>;
	changeEventName: keyof HTMLElementEventMap;
	isExclusive?: boolean;

	getView: () => boolean;
	setView: (isSelected: boolean) => void;
}

/** Add or remove ownValue on selectedItems */
export class SelectionItemCfg<T> {
	component: Component<any>;
	selectionCfg: DataSelectionCfg<T>;
	ownValue: T;
	isExclusive = false;
	changeEventName: keyof HTMLElementEventMap;

	constructor(configuration: ViewItemSelectionCfgOpts<T>) {
		this.component = configuration.component;
		this.selectionCfg = configuration.selectionCfg;
		this.ownValue = configuration.ownValue;
		this.changeEventName = configuration.changeEventName;

		this.getView = configuration.getView;
		this.setView = configuration.setView;

		if (configuration.isExclusive) this.isExclusive = configuration.isExclusive;
	}

	getOwnIndex = () => {
		return this.selectionCfg.selectedItems.value.indexOf(this.ownValue);
	};

	getView: () => boolean;
	setView: (isSelected: boolean) => void;

	getModel = () => {
		return this.getOwnIndex() != -1;
	};
	setModel = (isSelected: boolean) => {
		if (isSelected) {
			if (this.getOwnIndex() != -1) return; //already selected

			if (this.isExclusive == true)
				return (this.selectionCfg.selectedItems.value = [this.ownValue]);
			else this.selectionCfg.selectedItems.value.push(this.ownValue);
		} else {
			if (this.getOwnIndex() == -1) return; //already deselected
			this.selectionCfg.selectedItems.value.splice(this.getOwnIndex(), 1);
		}

		this.selectionCfg.selectedItems.triggerAll();
	};
}

export interface CheckableSelectionItemCfgOpts<T> {
	component: CheckableComponent<any>;
	ownValue: T;
	selectionCfg: DataSelectionCfg<T>;
	isExclusive?: boolean;
}
/** SelectionCfg for checkable components */
export class CheckableSelectionItemCfg<T> extends SelectionItemCfg<T> {
	component: CheckableComponent<any>;

	constructor(configuration: CheckableSelectionItemCfgOpts<T>) {
		super({
			...configuration,
			changeEventName: 'change',

			getView: () => {
				return this.component.checked;
			},
			setView: (isSelected: boolean) => {
				this.component.checked = isSelected;
			},
		});

		this.component = configuration.component;
	}
}

// HELPERS
/** Converts ValueObject to raw value. */
export function unwrapValue<T>(valueObject: ValueObject<T>): T {
	if (valueObject instanceof BindableObject) return valueObject.value;
	else return valueObject;
}
/** Converts ValueObject to BindableObject. */
export function unwrapBindable<T>(
	valueObject: ValueObject<T>
): BindableObject<T> {
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
	value: ValueType | undefined;
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
	addToClassConditionally: (
		value: string,
		condition: ValueObject<boolean>
	) => this;
	setStyle: (property: keyof CSSStyleDeclaration, value: string) => this;

	//content
	setText: (text: ValueObject<string>) => this;
	setValue: (value: ValueObject<ValueType>) => this;
	setHTML: (text: ValueObject<string>) => this;

	//events
	listen: (
		eventName: keyof HTMLElementEventMap,
		handler: ComponentEventHandler
	) => this;
	ignore: (
		eventName: keyof HTMLElementEventMap,
		handler: ComponentEventHandler
	) => this;

	//state
	/** Tracks bindings of the component. Key is BindableObject.uuid, value is the Binding. */
	bindings: Map<string, Binding<any>>;
	createBinding: <T>(
		bindable: BindableObject<T>,
		action: BindingAction<T>
	) => this;
	createSelectionBinding: <T>(configuration: SelectionItemCfg<T>) => this;
	createTightBinding: <T>(configuration: TightBindingCfg<T>) => this;
	removeBinding: <T>(bindable: BindableObject<T>) => this;
	updateBinding: <T>(bindable: BindableObject<T>) => this;
}

export interface CheckableComponent<T> extends Component<T> {
	checked: boolean;
}

export function Component<ValueType>(
	tagName: keyof HTMLElementTagNameMap
): Component<ValueType> {
	//create
	const component = document.createElement(tagName) as Component<ValueType>;

	//methods
	component.access = (fn) => {
		fn(component);
		return component;
	};
	component.setAccessibilityRole = (roleName) => {
		component.setAttr('role', roleName);
		return component;
	};

	component.addItems = (...children) => {
		component.append(...children);
		return component;
	};
	component.addItemsBefore = (...children) => {
		component.prepend(...children);
		return component;
	};
	component.clear = () => {
		component.innerHTML = '';
		return component;
	};
	component.setItems = (children) => {
		const bindable = unwrapBindable(children);

		component
			.createBinding(bindable, (children) => {
				component.clear().addItems(...children);
			})
			.updateBinding(bindable);

		return component;
	};

	component.setID = (id) => {
		component.id = id;
		return component;
	};
	component.setAttr = (key, value = '') => {
		const bindable = unwrapBindable(value);

		component
			.createBinding(bindable, (newValue) => {
				component.setAttribute(key, newValue);
			})
			.updateBinding(bindable);

		return component;
	};
	component.rmAttr = (key) => {
		component.removeAttribute(key);
		return component;
	};
	component.toggleAttr = (key, condition) => {
		const bindable = unwrapBindable(condition);

		component
			.createBinding(bindable, (newValue) => {
				component.toggleAttribute(key, newValue);
			})
			.updateBinding(bindable);

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
	component.addToClassConditionally = (className, condition) => {
		const bindable = unwrapBindable(condition);

		component
			.createBinding(bindable, (newValue) => {
				component.classList.toggle(className, newValue);
			})
			.updateBinding(bindable);

		return component;
	};
	component.setStyle = (property, value) => {
		(component.style as any)[property] = value;
		return component;
	};

	component.setText = (text) => {
		const bindable = unwrapBindable(text);

		component
			.createBinding(bindable, (newValue) => {
				component.innerText = newValue;
			})
			.updateBinding(bindable);

		return component;
	};
	component.setValue = (value) => {
		const bindable = unwrapBindable(value);

		component
			.createBinding(bindable, (newValue) => {
				component.value = newValue;
			})
			.updateBinding(bindable);

		return component;
	};
	component.setHTML = (text) => {
		const bindable = unwrapBindable(text);

		component
			.createBinding(bindable, (newValue) => {
				component.innerHTML = newValue;
			})
			.updateBinding(bindable);

		return component;
	};

	component.listen = (eventName, handler) => {
		component.addEventListener(eventName, handler);
		return component;
	};
	component.ignore = (eventName, handler) => {
		component.addEventListener(eventName, handler);
		return component;
	};

	component.bindings = new Map();
	component.createBinding = (bindable, action) => {
		const binding = {
			uuid: UUID(),
			action,
		};

		bindable.addBinding(binding);
		component.bindings.set(bindable.uuid, binding);

		return component;
	};
	component.createTightBinding = (configuration) => {
		component
			.createBinding(configuration.data, (newValue) => {
				configuration.setViewProperty(newValue);
			})
			.updateBinding(configuration.data)
			.listen(configuration.changeEventName, () => {
				configuration.data.value = configuration.getViewProperty();
			});

		return component;
	};
	component.createSelectionBinding = (configuration) => {
		component
			.createBinding(configuration.selectionCfg.selectedItems, () => {
				const isSelected = configuration.getOwnIndex() != -1;
				configuration.setView(isSelected);
			})
			.updateBinding(configuration.selectionCfg.selectedItems)
			.listen(configuration.changeEventName, () => {
				const isSelectedInView = configuration.getView();
				configuration.setModel(isSelectedInView);
			});

		return component;
	};
	component.removeBinding = (bindable) => {
		const binding = component.bindings.get(bindable.uuid);
		if (!binding) {
			console.error(
				`Failed to unbind ${bindable.uuid} but bindable is unknown.`
			);
			return component;
		}

		bindable.removeBinding(binding);
		component.bindings.delete(bindable.uuid);

		return component;
	};
	component.updateBinding = (bindable) => {
		const binding = component.bindings.get(bindable.uuid);
		if (!binding) {
			console.error(
				`Failed to update on bindable ${bindable.uuid} but bindable is unknown.`
			);
			return component;
		}

		bindable.triggerBinding(binding);

		return component;
	};

	return component;
}

// SPECIFIC
/* Accordion */
export function Accordion(label: string, ...children: Component<any>[]) {
	return Container(
		'details',
		Text(label, 'summary'),

		...children
	);
}

/* AutoComplete */
export function AutoComplete<T>(
	optionData: BindableObject<string[]>,
	input: Component<T>
) {
	const uuid = UUID();
	const optionViews = new ComputedState<Component<any>[]>({
		statesToBind: [optionData],
		initialValue: [],
		compute: (self) => {
			self.value = optionData.value.map((option) => Text(option, 'option'));
		},
	});

	return Div(
		Component('datalist').setID(uuid).setItems(optionViews),

		input.setAttr('list', uuid)
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
	Pressed = 'buttons-pressed',
}

export interface ButtonCfg {
	style?: ButtonStyles;
	text?: ValueObject<string>;
	iconName?: string;
	accessibilityLabel: ValueObject<string>;
	action: (e: Event) => void;
}

export function Button(configuration: ButtonCfg) {
	return Component('button')
		.addItems(
			Icon(configuration.iconName ?? ''),
			Text(configuration.text ?? '')
		)

		.setAttr('aria-label', configuration.accessibilityLabel)
		.addToClass('buttons')
		.addToClass(configuration.style ?? ButtonStyles.Normal)

		.listen('click', configuration.action);
}

/* ButtonGroup */
export function ButtonGroup(...buttons: Component<any>[]) {
	return Div(...buttons)
		.addToClass('button-groups');
}

/* Checkbox */
export interface CheckboxCfg {
	isChecked: BindableObject<boolean>,
	isIndeterminate?: BindableObject<boolean>,
	label: string,
}

export function Checkbox(configuration: CheckboxCfg) {
	return Text(configuration.label, 'label')
		.addItemsBefore(
			(
				Input({
					type: 'checkbox',
					fallbackValue: undefined,
					value: undefined,
					placeholder: undefined,
				}) as CheckableComponent<undefined>
			)
				.addToClass('checkable-items')
				.access((self) => {
					self.createTightBinding(
						new CheckTBCfg({
							isChecked: configuration.isChecked,
							component: self,
						})
					);

					if (configuration.isIndeterminate != undefined)
						self.createTightBinding(
							new TightBindingCfg<boolean>({
								component: self,
								data: configuration.isIndeterminate,
								fallbackValue: false,
								changeEventName: 'change',

								getViewProperty: () => (self as any).indeterminate,
								setViewProperty: (newValue) =>
									((self as any).indeterminate = newValue),
							})
						);
				})
		);
}

/* Container */
export function Container(
	tagName: keyof HTMLElementTagNameMap,
	...children: Component<any>[]
) {
	return Component(tagName).addItems(...children);
}

export function Div(...children: Component<any>[]) {
	return Container('div', ...children);
}

/* HStack */
export function HStack(...children: Component<any>[]) {
	return Div(...children).addToClass('stacks-horizontal');
}

/* Icon */
export function Icon(iconName: string) {
	return Text(iconName).addToClass('icons'); //TODO
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
		.addToClass('inputs')
		.access((self) => {
			self
				.setAttr('type', configuration.type)
				.setAttr('placeholder', configuration.placeholder ?? '');

			if (
				configuration.value != undefined &&
				configuration.fallbackValue != undefined
			)
				self.createTightBinding(
					new ValueTBCfg({
						data: configuration.value,
						component: self,
						fallbackValue: configuration.fallbackValue,
					})
				);
		});
}

/* Label */
export function Label(labelText: string, labeledItem: Component<any>) {
	return Component('label')
		.setText(labelText)
		.addItems(labeledItem)

		.addToClass('labels');
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
			self.value = listData.value.map((item) => compute(item));
		},
	});

	return VStack()
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
export interface ListItemCfg<T> {
	selectionCfg: DataSelectionCfg<T>;
	ownValue: T;
}

export function ListItem<T>(
	configuration: ListItemCfg<T>,
	...children: Component<any>[]
) {
	return Div(...children)
		.addToClass('list-items')
		.access((self) => {
			const selectionItemCfg = new SelectionItemCfg<T>({
				component: self,
				selectionCfg: configuration.selectionCfg,

				getView: () => self.getAttribute('aria-selected') == 'true',
				setView: (isSelected) =>
					self.setAttr('aria-selected', isSelected.toString()),

				isExclusive: true,
				ownValue: configuration.ownValue,

				changeEventName: 'click',
			});

			self
				.addToClass('listitems')
				.setAccessibilityRole('option')
				.listen('click', () => {
					selectionItemCfg.setModel(true);
				})
				.createSelectionBinding(selectionItemCfg);
		});
}

/* Meter */
export interface MeterOpts {
	min?: number;
	max?: number;
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

/* Popover */
export interface PopoverCfg {
	isOpen: BindableObject<boolean>;
	widthStyle: string;
	toggle: Component<any>;
	content: Component<any>;
}

export function Popover(configuration: PopoverCfg) {
	// Alignment
	const PADDING = '.5rem';

	const rectOfToggle = () => configuration.toggle.getBoundingClientRect();
	const rectOfContent = () => configuration.content.getBoundingClientRect();
	const rectOfWindow = document.body.getBoundingClientRect();

	function checkIsOK() {
		const rect = rectOfContent();

		return !(
			rect.top < rectOfWindow.top ||
			rect.left < rectOfWindow.left ||
			rect.right > rectOfWindow.right ||
			rect.bottom > rectOfWindow.bottom
		);
	}

	function alignToRightFromLeftEdge() {
		configuration.content.setStyle('left', `${rectOfToggle().left}px`);
	}

	function alignToRightFromRightEdge() {
		configuration.content.setStyle('left', `${rectOfToggle().right}px`);
	}

	function alignToLeftFromLeftEdge() {
		configuration.content.setStyle(
			'left',
			`${rectOfToggle().left - rectOfContent().width}px`
		);
	}

	function alignToLeftFromRightEdge() {
		configuration.content.setStyle(
			'left',
			`${rectOfToggle().right - rectOfContent().width}px`
		);
	}

	function tryXAxisFix() {
		alignToRightFromLeftEdge();
		if (checkIsOK() == true) return;

		alignToLeftFromRightEdge();
		if (checkIsOK() == true) return;
	}

	function alignY() {
		//down
		configuration.content
			.setStyle('left', 'unset')
			.setStyle('top', `${rectOfToggle().bottom}px`);
		if (checkIsOK() == true) return;

		tryXAxisFix();
		if (checkIsOK() == true) return;

		//up
		configuration.content
			.setStyle('left', 'unset')
			.setStyle('top', `${rectOfToggle().top - rectOfContent().height}px`);
		if (checkIsOK() == true) return;

		tryXAxisFix();
	}

	function alignX() {
		//to left
		configuration.content.setStyle('top', 'unset');

		alignToRightFromRightEdge();
		if (checkIsOK() == true) return;

		//to right
		configuration.content.setStyle('top', 'unset');

		alignToLeftFromLeftEdge();
	}

	function applyFallbackAlignment() {
		configuration.content
			.setStyle('bottom', PADDING)
			.setStyle('maxHeight', `calc(100% - 2*${PADDING})`);

		if (rectOfContent().left < rectOfWindow.left)
			//content overflows left edge
			configuration.content.setStyle('left', PADDING);
		if (rectOfContent().left < rectOfWindow.left)
			//content overflows right edge
			configuration.content.setStyle('right', PADDING);
	}

	function updateContentPosition() {
		if (configuration.isOpen.value == false) return;

		const alignmentFunctions = [alignY, alignX, applyFallbackAlignment];

		for (const fn of alignmentFunctions) {
			fn();
			if (checkIsOK() == true) return;
		}
	}

	// Reactivity
	function closePopover() {
		configuration.isOpen.value = false;
	}

	configuration.isOpen.addBinding({
		uuid: UUID(),
		action: (wasOpened) => {
			if (wasOpened) {
				document.body.addEventListener('click', closePopover);
				updateContentPosition();
			} else {
				document.body.removeEventListener('click', closePopover);
			}
		},
	});

	// Main
	return Div(
		configuration.toggle,
		configuration.content
			.addToClass('popover-contents')
			.setStyle('width', configuration.widthStyle)
	)
		.addToClass('popover-containers')
		.toggleAttr('open', configuration.isOpen)
		.listen('click', (e) => e.stopPropagation());
}

/* ProgressBar */
export enum ProgressBarStates {
	Normal,
	Indeterminate,
}

export function ProgressBar(
	value: BindableObject<number>,
	state: BindableObject<ProgressBarStates>
) {
	return Component<number>('progress')
		.setValue(value)
		.access((self) =>
			self
				.createBinding(state, (state) => {
					const isIndeterminate = state == ProgressBarStates.Indeterminate;
					if (isIndeterminate) self.rmAttr('value');
					else self.value = value.value;
				})
				.updateBinding(state)
		);
}

/* RadioButton */
export function RadioButton<T>(
	selectionCfg: DataSelectionCfg<T>,
	label: string,
	value: T,
) {
	return Text(label, 'label').addItemsBefore(
		(
			Input({
				type: 'radio',
				fallbackValue: undefined,
				value: undefined,
				placeholder: undefined,
			}) as CheckableComponent<undefined>
		)
			.access((self) =>
				self.createSelectionBinding(
					new CheckableSelectionItemCfg({
						selectionCfg,
						component: self,
						ownValue: value,
						isExclusive: true,
					})
				)
			)
			.setAttr('name', selectionCfg.uuid)
	);
}

/* Select */
export interface SelectOption {
	label: string;
	value: string;
}

export function Select(
	value: BindableObject<string>,
	options: BindableObject<SelectOption[]>
) {
	const optionViews = new ComputedState<Component<any>[]>({
		statesToBind: [options],
		initialValue: [],
		compute: (self) => {
			self.value = options.value.map((option) =>
				Text(option.label, 'option').setValue(option.value)
			);
		},
	});

	return Component('select')
		.setItems(optionViews)
		.addToClass('selects')
		.access((self) =>
			self.createTightBinding(
				new ValueTBCfg({
					component: self,
					data: value,
					fallbackValue: '',
				})
			)
		);
}

/* Separator */
export function Separator() {
	return Component('hr')
		.addToClass('separators');
}

/* Sheet */
export function Sheet(
	isOpen: BindableObject<boolean>,
	...children: Component<any>[]
) {
	return Container('dialog',
		Div(...children)
			.addToClass('sheet-contents')
			.listen('click', (e) => e.stopPropagation()),
	)
		.addToClass('sheet-containers')
		.toggleAttr('open', isOpen)
		.listen('click', () => {
			isOpen.value = false;
		});
}

/* Slider */
export interface SliderOpts {
	min?: number;
	max?: number;
	step?: number;
}

export function Slider(
	value: BindableObject<number>,
	options: SliderOpts = {}
) {
	return Input<number>({
		type: 'range',
		fallbackValue: 0,
		value,
		placeholder: undefined,
	}).access((self) =>
		self
			.setAttr('min', (options.min ?? 0).toString())
			.setAttr('max', (options.max ?? 100).toString())
			.setAttr('step', (options.step ?? 1).toString())
	);
}

/* Spacer */
export function Spacer() {
	return Div().addToClass('spacers');
}

/* Text */
export function Text(
	value: ValueObject<string>,
	tagName: keyof HTMLElementTagNameMap = 'span'
) {
	return Component(tagName).setText(value);
}

/* Textarea */
export function Textarea(value: BindableObject<string>, placeholder: string) {
	return Component<string>('textarea')
		.addToClass('textareas')
		.access((self) =>
			self
				.createTightBinding(
					new ValueTBCfg({
						component: self,
						data: value,
						fallbackValue: '',
					})
				)

				.setAttr('placeholder', placeholder)
		);
}

/* Toggle */
export function Toggle(configuration: CheckboxCfg) {
	return Checkbox(configuration)
		.addToClass('toggles');
}

/* VStack */
export function VStack(...children: Component<any>[]) {
	return Div(...children)
		.addToClass('stacks-vertical');
}
