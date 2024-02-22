import 'material-icons/iconfont/round.css';
import { PrefixedCSSPropertyNames } from 'css-property-names';
import AccessibilityRoleMap from './assets/roles.js';
import './styles/base.css';
import './styles/fonts.css';
import './styles/theme.css';

/*
 * MAIN
 */

/**
 * 'Root function'. Appends component to body.
 * Should be called exactly once.
 */
export function buildInterface(component: Component<any>) {
	document.body.appendChild(component);
}

/*
 * BASIC
 */
/**
 * Random UUID.
 * Stringifiable.
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

	toString() {
		return this.value;
	}
}

/**
 * Has a UUID.
 */
export interface Identifiable {
	readonly uuid: UUID;
}

/**
 * Has an index.
 */
export interface Sortable {
	index: BindableObject<number>;
}

/**
 * Has a toString() => string method.
 */
export interface Stringifiable {
	/**
	 * Returns string from object.
	 */
	toString: () => string;
}

/*
 *  REACTIVITY
 */
// VALUE
/**
 * Either BindableObject or plain value.
 * Unwrap using unwrapBindable() or unwrapValue() functions.
 */
export type ValueObject<T> = T | BindableObject<T>;

// BINDING
/**
 * Can be added to BindableObjects.
 * action() will be called when object changes.
 */
export interface Binding<T> {
	uuid: UUID;
	action: BindingAction<T>;
}

export type BindingAction<T> = (newValue: T) => void;

//tight binding
export interface GenericTBModelCfg<D, C> {
	readonly data: BindableObject<D>;
	readonly component: Component<C>;
	readonly fallbackValue: D;
	readonly changeEventName: keyof HTMLElementEventMap;

	getViewProperty: () => D;
	setViewProperty: (newValue: D) => void;
}
/**
 * Model for Two-way binding.
 */
export class GenericTBModel<D, C> {
	readonly data: BindableObject<D>;
	readonly component: Component<C>;
	readonly defaultValue: D;
	readonly changeEventName: keyof HTMLElementEventMap;

	constructor(configuration: GenericTBModelCfg<D, C>) {
		this.data = configuration.data;
		this.component = configuration.component;
		this.defaultValue = configuration.fallbackValue;
		this.changeEventName = configuration.changeEventName;

		this.getViewValue = configuration.getViewProperty;
		this.setViewValue = configuration.setViewProperty;
	}

	getViewValue: () => D;
	setViewValue: (newValue: D) => void;
}

export interface ValueTBModelOpts<T> {
	data: BindableObject<T>;
	component: Component<T>;
	fallbackValue: T;
}
/**
 * Two-way binding between BindableObject and a Component's value.
 */
export class ValueTBModel<T> extends GenericTBModel<T, T> {
	constructor(configuration: ValueTBModelOpts<T>) {
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

export interface CheckedTBModelCfg {
	isChecked: BindableObject<boolean>;
	component: CheckableComponent<any>;
}
/**
 * Two-way binding between BindableObject<boolean> and a Component's 'checked' property.
 */
export class CheckedTBModel extends ValueTBModel<boolean> {
	readonly component: CheckableComponent<any>;

	readonly changeEventName: keyof HTMLElementEventMap = 'change';

	constructor(configuration: CheckedTBModelCfg) {
		super({
			data: configuration.isChecked,
			component: configuration.component,
			fallbackValue: false,
		});
		this.component = configuration.component;
	}

	getViewValue = () => {
		return this.component.checked;
	};
	setViewValue = (newValue: boolean) => {
		this.component.checked = newValue;
	};
}

//selection
/**
 * Tracks 'selected' items in State<T[]>.
 */
export class DataSelection<T> {
	readonly uuid = new UUID();
	selectedItems = new State<T[]>([]);
}

export interface ValueSBModelCfg<T> {
	component: Component<any>;
	ownValue: T;
	selection: DataSelection<T>;
	changeEventName: keyof HTMLElementEventMap;
	isExclusive?: boolean;

	getView: () => boolean;
	setView: (isSelected: boolean) => void;
}

/** Add or remove ownValue on selectedItems */
export class ValueSBModel<T> {
	readonly component: Component<any>;
	readonly selection: DataSelection<T>;
	readonly ownValue: T;
	readonly changeEventName: keyof HTMLElementEventMap;
	isExclusive = false;

	constructor(configuration: ValueSBModelCfg<T>) {
		this.component = configuration.component;
		this.selection = configuration.selection;
		this.ownValue = configuration.ownValue;
		this.changeEventName = configuration.changeEventName;

		this.getView = configuration.getView;
		this.setView = configuration.setView;

		if (configuration.isExclusive)
			this.isExclusive = configuration.isExclusive;
	}

	getOwnIndex = () => {
		return this.selection.selectedItems.value.indexOf(this.ownValue);
	};

	getView: () => boolean;
	setView: (isSelected: boolean) => void;

	getData = () => {
		return this.getOwnIndex() != -1;
	};
	setData = (isSelected: boolean) => {
		if (isSelected) {
			if (this.getOwnIndex() != -1) return; //already selected

			if (this.isExclusive == true)
				return (this.selection.selectedItems.value = [this.ownValue]);
			else this.selection.selectedItems.value.push(this.ownValue);
		} else {
			if (this.getOwnIndex() == -1) return; //already deselected
			this.selection.selectedItems.value.splice(this.getOwnIndex(), 1);
		}

		this.selection.selectedItems.triggerAll();
	};
}

export interface CheckSBModelCfg<T> {
	component: CheckableComponent<any>;
	ownValue: T;
	selection: DataSelection<T>;
	isExclusive?: boolean;
}
/** SelectionCfg for checkable components */
export class CheckSBModel<T> extends ValueSBModel<T> {
	readonly component: CheckableComponent<any>;

	constructor(configuration: CheckSBModelCfg<T>) {
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

// BINDABLE
/**
 * Plain bindable object.
 * Use only for extending classes.
 */
export class BindableObject<T> {
	readonly uuid = new UUID();
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
	triggerBinding = (binding: Binding<T>) => {};
	triggerAll = () => {};
	addBinding = (binding: Binding<T>) => {};
	removeBinding = (binding: Binding<T>) => {};
}

/**
 * Polyfill BindableObject.
 * Can hold only one binding.
 */
export class BindableDummy<T> extends BindableObject<T> {
	action: BindingAction<T> | undefined;

	/* reactivity */
	triggerBinding = () => {
		if (this.action) this.action(this._value);
	};
	triggerAll = () => {
		if (this.action) this.action(this._value);
	};
	addBinding = (binding: Binding<T>) => {
		this.action = binding.action;
	};
}

/**
 * Fully functional BindableObject.
 * Recommended in most cases.
 */
export class State<T> extends BindableObject<T> {
	private bindings = new Map<Binding<T>['uuid'], Binding<T>['action']>();

	/* reactivity */
	triggerBinding = (binding: Binding<T>) => {
		binding.action(this.value);
	};
	triggerAll = () => {
		this.bindings.forEach((action) => {
			action(this.value);
		});
	};
	addBinding = (binding: Binding<T>) => {
		this.bindings.set(binding.uuid, binding.action);
	};
	removeBinding = (binding: Binding<T>) => {
		this.bindings.delete(binding.uuid);
	};
}

export interface ComputedStateCfg<T> {
	statesToBind: BindableObject<any>[];
	initialValue: T;
	compute: (self: ComputedState<T>) => void;
}
/**
 * State that binds other states.
 * compute() will be called when any of the states changes.
 */
export class ComputedState<T> extends State<T> {
	constructor(configuration: ComputedStateCfg<T>) {
		super(configuration.initialValue);

		const binding = {
			uuid: new UUID(),
			action: () => configuration.compute(this),
		};

		configuration.statesToBind.forEach((bindable) => {
			bindable.addBinding(binding);
			bindable.triggerBinding(binding);
		});
	}
}

/**
 * State<string> that is linked to localStorage.
 */
export class LocalStorageState extends State<string> {
	constructor(key: string, initialValue: string) {
		super(localStorage.getItem(key) ?? initialValue);

		this.addBinding({
			uuid: new UUID(),
			action: (newValue) => localStorage.setItem(key, newValue),
		});
	}
}

export interface ProxyStateCfg<T, O> {
	original: BindableObject<O>;
	convertFromOriginal: (originalValue: O) => T;
	convertToOriginal: (value: T) => O;
}
/**
 * State that binds another state.
 * Changes of the ProxyState will also change the bound state.
 * Conversion methods are specified via configuration.
 */
export class ProxyState<T, O> extends State<T> {
	readonly original: BindableObject<O>;
	readonly convertFromOriginal: (proxyValue: O) => T;
	readonly convertToOriginal: (proxyValue: T) => O;

	constructor(configuration: ProxyStateCfg<T, O>) {
		super(configuration.convertFromOriginal(configuration.original.value));

		this.original = configuration.original;
		this.convertFromOriginal = configuration.convertFromOriginal;
		this.convertToOriginal = configuration.convertToOriginal;

		const binding: Binding<O> = {
			uuid: new UUID(),
			action: () => {
				this._value = configuration.convertFromOriginal(
					this.original.value,
				);
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

/**
 * State that contains a Map.
 * Has methods for manipulating the map.
 */
export class IdentifiableObjectMap<T extends Identifiable> extends State<
	Map<string, T>
> {
	constructor() {
		super(new Map<string, T>());
	}

	get = (id: string | UUID) => {
		return this._value.get(id.toString());
	};

	set = (value: T) => {
		this.value.set(value.uuid.toString(), value);
		this.triggerAll();
	};

	remove = (value: T) => {
		this.value.delete(value.uuid.toString());
		this.triggerAll();
	};

	values = () => {
		return Array.from(this.value.values());
	};

	getSorted = (compareFn: (a: T, b: T) => number) => {
		return this.values().sort(compareFn);
	};

	forEach = (callbackFn: (value: T, index: number, array: T[]) => void) => {
		this.values().forEach(callbackFn);
	};

	clear = () => {
		this.value.clear();
		this.triggerAll();
	};

	get length() {
		return this.values().length;
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
	valueObject: ValueObject<T>,
): BindableObject<T> {
	if (valueObject instanceof BindableObject) return valueObject;
	else return new BindableDummy(unwrapValue(valueObject));
}

/*
 *COMPONENTS
 */
// GENERAL
export type ComponentEventHandler = (this: HTMLElement, e: Event) => void;
export type KeyboardShortcut = {
	modifiers?: (
		| 'ctrlKey'
		| 'shiftKey'
		| 'altKey'
		| 'metaKey'
		| 'commandOrControl'
	)[];
	key: KeyboardEvent['key'];
	action: (ev: KeyboardEvent) => void;
};
export enum ScreenSizes {
	Mobile = 'screen-mobile',
	Tablet = 'screen-tablet',
	Desktop = 'screen-desktop',
}
export type Styleable = {
	[property in keyof typeof PrefixedCSSPropertyNames]: (
		value: Stringifiable,
	) => Component<any>;
};

/** UI Component. */
export interface Component<ValueType> extends HTMLElement, Styleable {
	/**
	 * Value of the Component.
	 */
	value: ValueType;
	/**
	 * Provides access to component in callback function.
	 * Use if component must be accessed as variable.
	 */
	access: (accessFn: (self: this) => void) => this;
	/**
	 * Focuses component after creation.
	 */
	focusOnCreate: () => this;
	/**
	 * Focuses component when state changes to a specific value.
	 */
	focusOnMatch: <T>(state: BindableObject<T>, matchingValue: T) => this;
	/**
	 * Toggles ARIA-current.
	 */
	setAccessibilityCurrentState: (
		state: 'page' | 'step',
		shouldApply: BindableObject<boolean>,
	) => this;
	/**
	 * Sets ARIA-label.
	 */
	setAccessibilityLabel: (label: ValueObject<string>) => this;
	/**
	 * Sets ARIA-role.
	 */
	setAccessibilityRole: (roleName: keyof AccessibilityRoleMap) => this;
	allowKeyboardFocus: () => this;
	
	//attributes
	/**
	 * Sets HTML id.
	 */
	setID: (id: string | UUID) => this;
	/**
	 * Sets HTML attribute.
	 */
	setAttr: (key: string, value?: ValueObject<Stringifiable>) => this;
	/**
	 * Removes HTML attribute.
	 */
	rmAttr: (key: string) => this;
	/**
	 * Toggles HTML attribute.
	 * Supports BindableObject<boolean>.
	 */
	toggleAttr: (key: string, condition: ValueObject<boolean>) => this;
	/**
	 * Resets HTML className.
	 */
	resetClasses: (value: string) => this;
	/**
	 * Removes HTML className.
	 */
	removeFromClass: (value: string) => this;
	/**
	 * Adds HTML className.
	 */
	addToClass: (value: string) => this;
	/**
	 * Toggles HTML className.
	 * Supports BindableObject<boolean>.
	 */
	addToClassConditionally: (
		value: string,
		condition: ValueObject<boolean>,
	) => this;
	/**
	 * Sets CSS style.
	 * Not recommended. Use .cssProperty() methods instead (e.g. cssWidth('100%').
	 */
	setStyle: (
		property: keyof CSSStyleDeclaration,
		value: Stringifiable,
	) => this;

	//children
	/**
	 * Appends child Components.
	 */
	addItems: (...children: Component<any>[]) => this;
	/**
	 * Prepends child Components.
	 */
	addItemsBefore: (...children: Component<any>[]) => this;
	/**
	 * Clears innerHTML.
	 */
	clear: () => this;
	/**
	 * Sets child Components by array.
	 * Supports BindableObject<Component<any>[]>.
	 */
	setItems: (children: ValueObject<Component<any>[]>) => this;

	//content
	/**
	 * Sets innerText.
	 */
	setText: (text: ValueObject<Stringifiable>) => this;
	/**
	 * Sets value.
	 */
	setValue: (value: ValueObject<ValueType>) => this;
	/**
	 * Sets innerHTML.
	 */
	setHTML: (text: ValueObject<string>) => this;

	//events
	/**
	 * Adds eventListener.
	 */
	listen: (
		eventName: keyof HTMLElementEventMap,
		handler: ComponentEventHandler,
	) => this;
	/**
	 * Removes eventListener.
	 */
	ignore: (
		eventName: keyof HTMLElementEventMap,
		handler: ComponentEventHandler,
	) => this;
	/**
	 * Registers keyboard shortcuts on component.
	 */
	registerKeyboardShortcuts: (...shortcuts: KeyboardShortcut[]) => this;

	//navigation
	/**
	 * Hides based on boolean.
	 * Supports BindableObject<boolean>.
	 */
	hideConditionally: (isHidden: ValueObject<boolean>) => this;
	/**
	 * Shows if both values match.
	 * Supports BindableObjects.
	 */
	setVisibleIfMatch: <T>(a: ValueObject<T>, b: ValueObject<T>) => this;

	//state
	/**
	 * Tracks Bindings of the Component.
	 * Key is BindableObject.uuid, value is the Binding.
	 */
	bindings: Map<string, Binding<any>>;
	/**
	 * Creates a Binding and adds it to a BindableObject.
	 */
	createBinding: <T>(
		bindable: BindableObject<T>,
		action: BindingAction<T>,
	) => this;
	/**
	 * Creates Binding to a DataSelection.
	 */
	createSelectionBinding: <T>(model: ValueSBModel<T>) => this;
	/**
	 * Creates two-way binding.
	 */
	createTightBinding: <D, C>(model: GenericTBModel<D, C>) => this;
	/**
	 * Removes Binding from BindableObject.
	 */
	removeBinding: <T>(bindable: BindableObject<T>) => this;
	/**
	 * Triggers the action associated with the Binding.
	 */
	updateBinding: <T>(bindable: BindableObject<T>) => this;

	//style
	/**
	 * Disables container-specific styles.
	 */
	//TODO remove
	forceDefaultStyles: () => this;
	/**
	 * Hides component on specific screen size.
	 */
	hideOnScreenSize: (size: ScreenSizes) => this;
	/**
	 * Applies default padding.
	 */
	useDefaultPadding: () => this;
	/**
	 * Applies default gap.
	 */
	useDefaultSpacing: () => this;
	/**
	 * Applies gray color.
	 */
	useMutedColor: () => this;
}

/**
 * Component with checked: boolean property.
 */
export interface CheckableComponent<T> extends Component<T> {
	checked: boolean;
}

export function Component<ValueType>(
	tagName: keyof HTMLElementTagNameMap,
): Component<ValueType> {
	//create
	const component = document.createElement(tagName) as Component<ValueType>;

	//styles
	Object.keys(PrefixedCSSPropertyNames).forEach((componentProperty) => {
		const cssProperty =
			PrefixedCSSPropertyNames[
				componentProperty as keyof typeof PrefixedCSSPropertyNames
			];

		component[componentProperty as keyof Styleable] = (value) => {
			component.setStyle(cssProperty as keyof CSSStyleDeclaration, value);
			return component;
		};
	});

	//methods
	component.access = (fn) => {
		fn(component);
		return component;
	};
	component.focusOnCreate = () => {
		setTimeout(() => component.focus(), 100);
		return component;
	};
	component.focusOnMatch = (state, matchingValue) => {
		component.createBinding(state, (newValue) => {
			// timeout needed for overlays
			if (newValue == matchingValue)
				setTimeout(() => component.focus(), 100);
		});
		return component;
	};
	component.setAccessibilityCurrentState = (state, shouldApply) => {
		component.createBinding(shouldApply, (shouldApply) => {
			component.setAttr('aria-current', shouldApply ? state : '');
		});
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
		const bindable = unwrapBindable(value);

		component
			.createBinding(bindable, (newValue) => {
				component.setAttribute(key, newValue.toString());
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
				if (newValue == true) component.setAttribute(key, '');
				else component.removeAttribute(key);
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
		(component.style as any)[property] = value.toString();
		return component;
	};

	//children
	component.addItems = (...children) => {
		children.forEach((child) => {
			component.appendChild(child);
		});
		return component;
	};
	component.addItemsBefore = (...children) => {
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
		const bindable = unwrapBindable(children);

		component
			.createBinding(bindable, (children) => {
				component.clear().addItems(...children);
			})
			.updateBinding(bindable);

		return component;
	};

	//content
	component.setText = (text) => {
		const bindable = unwrapBindable(text);

		component
			.createBinding(bindable, (newValue) => {
				component.innerText = newValue.toString();
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

	//events
	component.listen = (eventName, handler) => {
		component.addEventListener(eventName, handler);
		return component;
	};
	component.ignore = (eventName, handler) => {
		component.addEventListener(eventName, handler);
		return component;
	};
	component.registerKeyboardShortcuts = (...shortcuts) => {
		component.listen('keydown', (rawEvent) => {
			const ev = rawEvent as KeyboardEvent;

			A: for (const shortcut of shortcuts) {
				//make sure all modifiers are pressed
				if (shortcut.modifiers)
					for (const modifier of shortcut.modifiers) {
						if (modifier == 'commandOrControl') {
							if (ev.ctrlKey == false && ev.metaKey == false)
								continue A;
						} else if (ev[modifier] == false) {
							continue A;
						}
					}
				if (ev.key == shortcut.key) {
					shortcut.action(ev);
				}
			}
		});
		return component;
	};

	//navigation
	component.hideConditionally = (isHidden) => {
		component.toggleAttr('hidden', isHidden);
		component.setAttr('aria-hidden', isHidden);
		return component;
	};
	component.setVisibleIfMatch = (a, b) => {
		const bindableA = unwrapBindable(a);
		const bindableB = unwrapBindable(b);

		function update() {
			component.hideConditionally(bindableA.value != bindableB.value);
		}

		component
			.createBinding(bindableA, update)
			.updateBinding(bindableA)
			.createBinding(bindableB, update)
			.updateBinding(bindableB);

		return component;
	};

	//state
	component.bindings = new Map();
	component.createBinding = (bindable, action) => {
		const binding = {
			uuid: new UUID(),
			action,
		};

		bindable.addBinding(binding);
		component.bindings.set(bindable.uuid.toString(), binding);

		return component;
	};
	component.createTightBinding = (model) => {
		component
			.createBinding(model.data, (newValue) => {
				model.setViewValue(newValue);
			})
			.updateBinding(model.data)
			.listen(model.changeEventName, () => {
				model.data.value = model.getViewValue();
			});

		return component;
	};
	component.createSelectionBinding = (model) => {
		component
			.createBinding(model.selection.selectedItems, () => {
				const isSelected = model.getOwnIndex() != -1;
				model.setView(isSelected);
			})
			.updateBinding(model.selection.selectedItems)
			.listen(model.changeEventName, () => {
				const isSelectedInView = model.getView();
				model.setData(isSelectedInView);
			});

		return component;
	};
	component.removeBinding = (bindable) => {
		const binding = component.bindings.get(bindable.uuid.toString());
		if (!binding) {
			console.error(
				`Failed to unbind ${bindable.uuid.toString()} but bindable is unknown.`,
			);
			return component;
		}

		bindable.removeBinding(binding);
		component.bindings.delete(bindable.uuid.toString());

		return component;
	};
	component.updateBinding = (bindable) => {
		const binding = component.bindings.get(bindable.uuid.toString());
		if (!binding) {
			console.error(
				`Failed to update on bindable ${bindable.uuid.toString()} but bindable is unknown.`,
			);
			return component;
		}

		bindable.triggerBinding(binding);

		return component;
	};

	//style
	component.forceDefaultStyles = () => {
		component.addToClass('forcing-default-styles');
		return component;
	};
	component.hideOnScreenSize = (size) => {
		component.addToClass('hides-responsively').addToClass(size);
		return component;
	};
	component.useDefaultPadding = () => {
		component.addToClass('using-default-padding');
		return component;
	};
	component.useDefaultSpacing = () => {
		component.cssGap('var(--gap)');
		return component;
	};
	component.useMutedColor = () => {
		component.cssOpacity(0.6);
		return component;
	};

	return component.addToClass('frugal-ui-components');
}

// SPECIFIC
/* Accordion */
export function Accordion(label: string, ...children: Component<any>[]) {
	return Container(
		'details',
		Text(label, 'summary'),

		...children,
	)
		.addToClass('accordions')
		.useDefaultPadding();
}

/* AutoComplete */
/**
 * Contains Input and datalist-div.
 */
export function AutoComplete<T>(
	optionData: ValueObject<string[]>,
	input: Component<T>,
) {
	const bindableOptionData = unwrapBindable(optionData);
	const uuid = new UUID();
	const optionViews = new ComputedState<Component<any>[]>({
		statesToBind: [bindableOptionData],
		initialValue: [],
		compute: (self) => {
			self.value = bindableOptionData.value.map((option) =>
				Text(option, 'option'),
			);
		},
	});

	return Div(
		Component('datalist').setID(uuid).setItems(optionViews),
		input.setAttr('list', uuid),
	);
}

/* Box */
/** Div with 'box' styles.
 */
export function Box(...children: Component<any>[]) {
	return Div(...children).addToClass('boxes');
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
	text?: ValueObject<Stringifiable>;
	iconName?: string;
	accessibilityLabel: ValueObject<Stringifiable>;
	action: (e: Event) => void;
}

export function Button(configuration: ButtonCfg) {
	return Component('button')
		.addItems(
			Icon(configuration.iconName ?? ''),
			Text(configuration.text ?? '').addToClass('button-texts'),
		)

		.setAttr('aria-label', configuration.accessibilityLabel)
		.addToClass('buttons')
		.addToClass(configuration.style ?? ButtonStyles.Normal)

		.listen('click', (e) => {
			e.stopPropagation();
			configuration.action(e);
		});
}

/* ButtonGroup */
export function ButtonGroup(...buttons: Component<any>[]) {
	return Div(...buttons).addToClass('button-groups');
}

/* Checkbox */
export interface CheckboxCfg {
	isChecked: BindableObject<boolean>;
	isIndeterminate?: BindableObject<boolean>;
	label: string;
}

export function Checkbox(configuration: CheckboxCfg) {
	return Text(configuration.label, 'label').addItemsBefore(
		(
			Input({
				type: 'checkbox',
				fallbackValue: undefined,
				value: undefined,
				placeholder: undefined,
				toValueType: (inputValue) => inputValue,
				valueToString: (inputValue) => inputValue,
			}) as CheckableComponent<string>
		)
			.addToClass('checkable-items')
			.access((self) => {
				self.createTightBinding(
					new CheckedTBModel({
						isChecked: configuration.isChecked,
						component: self,
					}),
				);

				if (configuration.isIndeterminate != undefined)
					self.createTightBinding(
						new GenericTBModel<boolean, string>({
							component: self,
							data: configuration.isIndeterminate,
							fallbackValue: false,
							changeEventName: 'change',

							getViewProperty: () => (self as any).indeterminate,
							setViewProperty: (newValue) =>
								((self as any).indeterminate = newValue),
						}),
					);
			}),
	);
}

/* Command Shell */
/**
 * One of the commands to register with in CommandShell.
 * Action will be executed when user runs the command.
 */
export interface Command {
	commandName: string;
	action: () => void;
}

/**
 * UI shell with vim-like command bar at the bottom.
 * Consider using this instead of keyboard shortcuts.
 */
export function CommandShell(commands: Command[], mainView: Component<any>) {
	let previouslyFocusedElement = document.activeElement as HTMLElement;

	/** blurs input when triggered */
	const inputBlurrer = new State(null);

	const commandQuery = new State('');
	const isInputFocused = new State(false);
	const isInvalid = new State(false);
	const optionData = commands.map((command) => command.commandName);

	function focusCommandPalette() {
		previouslyFocusedElement = document.activeElement as HTMLElement;
		isInputFocused.value = true;
	}
	function blurCommandPalette() {
		commandQuery.value = '';
		inputBlurrer.triggerAll();
		previouslyFocusedElement?.focus();
	}
	function executeCommand() {
		const matchingCommand = commands.find(
			(command) => command.commandName == commandQuery.value,
		);
		if (matchingCommand == undefined) {
			isInvalid.value = true;
			return;
		} else {
			matchingCommand.action();
			isInvalid.value = false;
			blurCommandPalette();
		}
	}

	document.body.addEventListener('keyup', (e) => {
		if (e.key != ':') return;
		focusCommandPalette();
	});

	return VStack(
		mainView.cssHeight('100%'),
		AutoComplete(
			optionData,
			Input(new TextInputCfg(commandQuery, 'Press ":" to run a command'))
				.focusOnMatch(isInputFocused, true)
				.cssWidth('100%')
				.cssBorderRadius('0rem')

				.toggleAttr('invalid', isInvalid)
				.access((self) => self.createBinding(inputBlurrer, () => self.blur()))

				.registerKeyboardShortcuts(
					{
						key: 'Escape',
						action: blurCommandPalette,
					},
					{
						key: 'Enter',
						action: executeCommand,
					},
				),
		).addToClass('command-shells'),
	);
}

/* Container */
export function Container(
	tagName: keyof HTMLElementTagNameMap,
	...children: Component<any>[]
) {
	return Component(tagName).addItems(...children);
}

/* Div */
export function Div(...children: Component<any>[]) {
	return Container('div', ...children);
}

/* Form */
export interface FormCfg {
	action: ValueObject<Stringifiable>;
	method: ValueObject<Stringifiable>;
}

/**
 * HTML form element.
 */
export function Form(configuration: FormCfg, ...children: Component<any>[]) {
	return Container('form', ...children)
		.setAttr('action', configuration.action)
		.setAttr('method', configuration.method);
}

/* Header */
export interface HeaderCfg {
	parentScene?: GenericScene<any>;
	text: ValueObject<string>;
	hideTextOnMobile?: boolean;
	forceShowBackButton?: boolean;
}

export function Header(configuration: HeaderCfg, ...actions: Component<any>[]) {
	return HStack()
		.access((self) => {
			if (configuration.parentScene)
				self.addItems(
					Button({
						style: ButtonStyles.Transparent,
						iconName: 'chevron_left',
						accessibilityLabel: 'go back',
						action: configuration.parentScene.close,
					}).access((self) => {
						if (!configuration.forceShowBackButton == true)
							self.hideOnScreenSize(ScreenSizes.Desktop);
					}),
				);
		})
		.addItems(
			Text(configuration.text, 'h5').access((self) => {
				if (configuration.hideTextOnMobile == true)
					self.hideOnScreenSize(ScreenSizes.Mobile);
			}),
			Spacer(),
			...actions,
		)
		.cssFlex(0)
		.useDefaultSpacing()
		.addToClass('headers');
}

/* HStack */
/**
 * Horizontal stack.
 */
export function HStack(...children: Component<any>[]) {
	return Div(...children).addToClass('stacks-horizontal');
}

/* Icon */
export function Icon(iconName: ValueObject<string>) {
	return Text(iconName)
		.addToClass('icons')
		.addToClass('material-icons-round')
		.setAttr('translate', 'no');
}

/* Input */
export interface InputCfg<T extends Stringifiable> {
	type: string;
	value: BindableObject<T> | undefined;
	toValueType: (inputValue: string) => T;
	valueToString: (value: T) => string;
	fallbackValue: T | undefined;
	placeholder?: string | undefined;
}

/**
 * Configures input as type='text'.
 */
export class TextInputCfg implements InputCfg<string> {
	type = 'text';
	value: BindableObject<string>;
	toValueType = (inputValue: string) => inputValue;
	valueToString = (value: string) => value;
	fallbackValue: string;
	placeholder: string;

	constructor(value: BindableObject<string>, placeholder = '') {
		this.fallbackValue = value.value;
		this.value = value;
		this.placeholder = placeholder;
	}
}

/**
 * Configures input as type='number'.
 */
export class NumberInputCfg implements InputCfg<number> {
	type = 'number';
	value: BindableObject<number>;
	toValueType = (inputValue: string) => parseFloat(inputValue);
	valueToString = (value: number) => value.toString();
	fallbackValue: number;
	placeholder: string;

	constructor(value: BindableObject<number>, placeholder = '') {
		this.fallbackValue = value.value;
		this.value = value;
		this.placeholder = placeholder;
	}
}

/**
 * Configures input as type='date'.
 */
export class DateInputCfg implements InputCfg<Date> {
	type = 'date';
	value: BindableObject<Date>;
	toValueType = (inputValue: string) => new Date(inputValue);
	valueToString = (value: Date) => {
		const day = value.toLocaleString('en-US', {
			day: '2-digit',
		});
		const month = value.toLocaleString('en-US', {
			month: '2-digit',
		});
		const year = value.getFullYear();
		return `${year}-${month}-${day}`;
	};
	fallbackValue: Date;
	placeholder: string;

	constructor(value: BindableObject<Date>, placeholder = '') {
		this.fallbackValue = value.value;
		this.value = value;
		this.placeholder = placeholder;
	}
}

/**
 * Configures input as type='time'.
 */
export class TimeInputCfg extends DateInputCfg {
	type = 'time';
	toValueType = (inputValue: string) => {
		const date = new Date();
		const [hours, minutes] = inputValue.split(':');
		date.setHours(parseInt(hours));
		date.setMinutes(parseInt(minutes));
		return date;
	};
	valueToString = (value: Date) => {
		const hour = value.getHours().toString().padStart(2, '0');
		const minute = value.getMinutes().toString().padStart(2, '0');

		return `${hour}:${minute}`;
	};
}

/**
 * HTML input.
 * Use of pre-defined configurations is recommended (e.g. new TextInputCfg()).
 */
export function Input<T extends Stringifiable>(configuration: InputCfg<T>) {
	return Component<string>('input')
		.addToClass('inputs')
		.access((self) => {
			self.setAttr('type', configuration.type).setAttr(
				'placeholder',
				configuration.placeholder ?? '',
			);

			if (
				configuration.value != undefined &&
				configuration.fallbackValue != undefined
			)
				self.createTightBinding({
					data: configuration.value,
					component: self,
					defaultValue: configuration.fallbackValue,
					changeEventName: 'input',
					getViewValue: () => configuration.toValueType(self.value),
					setViewValue: (newValue) =>
						(self.value = configuration.valueToString(newValue)),
				});
		});
}

/* Label */
/**
 * HTML label.
 * Contains labeled item.
 */
export function Label(labelText: string, labeledItem: Component<any>) {
	return Component('label')
		.setText(labelText)
		.addItems(labeledItem)

		.addToClass('labels');
}

/* Link */
/**
 * HTML anchor.
 */
export function Link(label: ValueObject<string>, href: string) {
	return Text(label, 'a').setAttr('href', href);
}

/* List */
export enum ListStyles {
	Normal = 'list',
	Group = 'list',
	Box = 'listbox',
}

export interface ListCfg<T extends Identifiable & Sortable> {
	listData: IdentifiableObjectMap<T>;
	dragToSort?: boolean;
	style?: ListStyles;
}
export function List<T extends Identifiable & Sortable>(
	configuration: ListCfg<T>,
	compute: (itemData: T) => Component<any>,
) {
	// Sorting
	let draggedComponent: Component<any> | undefined = undefined;
	let draggedData: T | undefined = undefined;
	let dragStartTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

	const compareFn = (a: T, b: T) => a.index.value - b.index.value;

	function cleanIndices() {
		configuration.listData
			.values()
			.sort(compareFn)
			.forEach((item, i) => (item.index.value = i));
	}

	function startDrag(e: Event, data: T, component: Component<any>) {
		document.body.addEventListener('mouseup', stopDrag);
		document.body.addEventListener('touchend', stopDrag);

		dragStartTimeout = setTimeout(() => {
			draggedData = data;
			draggedComponent = component.addToClass('dragging');
		}, 200);
	}
	function handleDragMove(e: TouchEvent | PointerEvent) {
		if (draggedData == undefined) return;

		function getCoordinate(
			e: TouchEvent | PointerEvent,
			axis: 'clientX' | 'clientY',
		) {
			if ('touches' in e) {
				return e.touches[0][axis];
			} else if (axis in e) {
				return e[axis];
			}
			//fallback
			return 0;
		}

		const elementUnderCursor = document.elementFromPoint(
			getCoordinate(e, 'clientX'),
			getCoordinate(e, 'clientY'),
		);

		if (elementUnderCursor == null) return;
		const data = configuration.listData.get(elementUnderCursor.id);
		if (data == null) return;

		const ownIndex = data.index.value;
		const currentDraggedIndex = draggedData.index.value;

		draggedData.index.value = ownIndex;
		data.index.value = currentDraggedIndex;
	}
	function stopDrag() {
		if (dragStartTimeout) clearTimeout(dragStartTimeout);
		if (draggedData == undefined) return;

		document.body.removeEventListener('mouseup', stopDrag);
		document.body.removeEventListener('touchend', stopDrag);

		draggedData = undefined;

		cleanIndices();

		if (draggedComponent == undefined) return;
		draggedComponent.removeFromClass('dragging');
		draggedComponent = undefined;
	}

	// Main
	const style = configuration.style ?? ListStyles.Normal;

	return VStack()
		.setAccessibilityRole(style)

		.listen('touchmove', (e) => handleDragMove(e as TouchEvent))
		.listen('mousemove', (e) => handleDragMove(e as PointerEvent))

		.access((listView) => {
			if (style == ListStyles.Box) listView.addToClass('boxes');
			if (style == ListStyles.Group) listView.addToClass('visual-groups');

			listView
				.createBinding(configuration.listData, (itemMap) => {
					cleanIndices();

					function removeItemView(
						itemView: Component<any> | Element,
					) {
						itemView.remove()
					}

					//add new items
					configuration.listData
						.getSorted(compareFn)
						.forEach((itemData, i) => {
							const oldItemView = document.getElementById(
								itemData.uuid.toString(),
							);

							//already exists
							if (oldItemView != null) return;
							configuration.listData.addBinding({
								uuid: new UUID(),
								action: () => itemData.index.triggerAll(),
							});

							const newItemView = compute(itemData)
								.setID(itemData.uuid)
								.access((self) => {
									//remove when index changed
									self.createBinding(itemData.index, () => {
										//set order
										self.cssOrder(
											itemData.index.value.toString(),
										);
										self.addToClassConditionally(
											'first-item',
											itemData.index.value == 0,
										);
										self.addToClassConditionally(
											'last-item',
											itemData.index.value ==
												configuration.listData.length -
													1,
										);
									}).updateBinding(itemData.index);

									if (configuration.dragToSort == true)
										self.addToClass('draggable-items')
											.addToClass('rearrangable-items')

											.listen('mousedown', (e) =>
												startDrag(e, itemData, self),
											)
											.listen('touchstart', (e) =>
												startDrag(e, itemData, self),
											);
								})

							listView.append(newItemView);
						});

					//remove deleted items
					Array.from(listView.children).forEach(
						(itemView: Element) => {
							const matchingDataEntry = itemMap.get(itemView.id);
							if (matchingDataEntry != undefined) return; //data entry still exists

							removeItemView(itemView);
						},
					);
				})
				.updateBinding(configuration.listData)
				.cssJustifyContent('start')
				.addToClass('ordered-containers');
		});
}

/* ListItem */
export function ListItem(...children: Component<any>[]) {
	return Div(...children)
		.addToClass('list-items')
		.setAccessibilityRole('listitem')
}

/* Meter */
export interface MeterOpts {
	min?: number;
	max?: number;
	low?: number;
	high?: number;
}

/**
 * HTML meter.
 */
export function Meter(value: BindableObject<number>, options: MeterOpts = {}) {
	const min = options.min ?? 0;
	const max = options.max ?? 1;
	const low = options.low ?? min;
	const high = options.high ?? max;

	return Component<number>('meter')
		.setValue(value)

		.setAttr('min', min)
		.setAttr('max', max)
		.setAttr('low', low)
		.setAttr('high', high);
}

/* Popover */
export interface PopoverCfg {
	isOpen: BindableObject<boolean>;
	toggle: Component<any>;
	content: Component<any>;
	accessibilityLabel: string;
}

export function Popover(configuration: PopoverCfg) {
	// Alignment
	const PADDING = '.5rem';

	resetPosition();

	const rectOfToggle = () => configuration.toggle.getBoundingClientRect();
	let rectOfContent = () => configuration.content.getBoundingClientRect();
	let rectOfWindow = () => document.body.getBoundingClientRect();

	function checkIsOK() {
		const isOK = !(
			rectOfContent().top < rectOfWindow().top ||
			rectOfContent().left < rectOfWindow().left ||
			rectOfContent().right > rectOfWindow().right ||
			rectOfContent().bottom > rectOfWindow().bottom
		);
		return isOK;
	}

	function resetPosition() {
		configuration.content
			.cssTop('unset')
			.cssLeft('unset')
			.cssRight('unset')
			.cssBottom('unset')

			.cssMaxHeight('unset')
			.cssMaxWidth('unset');
	}

	function alignToRightFromLeftEdge() {
		configuration.content.cssLeft(`${rectOfToggle().left}px`);
	}

	function alignToRightFromRightEdge() {
		configuration.content.cssLeft(`${rectOfToggle().right}px`);
	}

	function alignToLeftFromLeftEdge() {
		configuration.content.cssLeft(
			`${rectOfToggle().left - rectOfContent().width}px`,
		);
	}

	function alignToLeftFromRightEdge() {
		configuration.content.cssLeft(
			`${rectOfToggle().right - rectOfContent().width}px`,
		);
	}

	function tryXAxisFix() {
		alignToRightFromLeftEdge();
		if (checkIsOK() == true) return;
		alignToLeftFromRightEdge();
	}

	function alignY() {
		//down
		resetPosition();

		configuration.content.cssTop(`${rectOfToggle().bottom}px`);
		if (checkIsOK() == true) return;

		tryXAxisFix();
		if (checkIsOK() == true) return;

		//up
		resetPosition();

		configuration.content.cssTop(
			`${rectOfToggle().top - rectOfContent().height}px`,
		);
		if (checkIsOK() == true) return;

		tryXAxisFix();
	}

	function alignX() {
		//to left
		resetPosition();

		alignToRightFromRightEdge();
		if (checkIsOK() == true) return;

		//to right
		resetPosition();

		alignToLeftFromLeftEdge();
	}

	function applyFallbackAlignment() {
		resetPosition();

		configuration.content
			.cssBottom(PADDING)
			.cssMaxHeight(`calc(100% - 2*${PADDING})`)
			.cssMaxWidth(`calc(100% - 2*${PADDING})`)
			.cssLeft(PADDING)
			.cssRight(PADDING);
	}

	function updateContentPosition() {
		if (configuration.isOpen.value == false) return;

		const alignmentFunctions = [alignY, alignX, applyFallbackAlignment];

		for (let i = 0; i < alignmentFunctions.length; i++) {
			alignmentFunctions[i]();
			if (checkIsOK() == true) return;
		}
	}

	// Reactivity
	function closePopover() {
		configuration.isOpen.value = false;
	}

	configuration.isOpen.addBinding({
		uuid: new UUID(),
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
			.setAttr('aria-modal', 'true')
			.setAccessibilityLabel(configuration.accessibilityLabel)
			.allowKeyboardFocus()
			.focusOnMatch(configuration.isOpen, true),
	)
		.listen('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
		})
		.addToClass('popover-containers')
		.toggleAttr('open', configuration.isOpen);
}

/* ProgressBar */
export enum ProgressBarStates {
	Normal,
	Indeterminate,
}

export function ProgressBar(
	value: BindableObject<number>,
	state?: BindableObject<ProgressBarStates>,
) {
	return Component<number>('progress')
		.setValue(value)
		.access((self) => {
			if (state)
				self.createBinding(state, (state) => {
					const isIndeterminate =
						state == ProgressBarStates.Indeterminate;
					if (isIndeterminate) self.rmAttr('value');
					else self.value = value.value;
				}).updateBinding(state);
		});
}

/* RadioButton */
export interface RadioButtonCfg<T> {
	selectionCfg: DataSelection<T>;
	label: string;
	value: T;
}

export function RadioButton<T>(configuration: RadioButtonCfg<T>) {
	return Text(configuration.label, 'label').addItemsBefore(
		(
			Input({
				type: 'radio',
				fallbackValue: undefined,
				value: undefined,
				placeholder: undefined,
				toValueType: (inputValue) => inputValue,
				valueToString: (inputValue) => inputValue,
			}) as CheckableComponent<string>
		)
			.access((self) =>
				self.createSelectionBinding(
					new CheckSBModel({
						selection: configuration.selectionCfg,
						component: self,
						ownValue: configuration.value,
						isExclusive: true,
					}),
				),
			)
			.setAttr('name', configuration.selectionCfg.uuid),
	);
}

/* ScrollArea */
export function ScrollArea(...children: Component<any>[]) {
	return Div(...children).addToClass('scroll-areas');
}

/* Select */
export interface SelectOption {
	label: string;
	value: string;
}

/**
 * HTML select.
 */
export function Select(
	value: BindableObject<string>,
	options: BindableObject<SelectOption[]>,
) {
	const optionViews = new ComputedState<Component<any>[]>({
		statesToBind: [options],
		initialValue: [],
		compute: (self) => {
			self.value = options.value.map((option) =>
				Text(option.label, 'option').setValue(option.value),
			);
		},
	});

	return Component('select')
		.setItems(optionViews)
		.addToClass('selects')
		.access((self) =>
			self.createTightBinding(
				new ValueTBModel({
					component: self,
					data: value,
					fallbackValue: '',
				}),
			),
		);
}

/* SelectingListItem */
/**
 * ListItem that updates a DataSelection.
 * Alternative to Select in certain applications.
 */
export interface SelectingListItemCfg<T> {
	selection: DataSelection<T>;
	ownValue: T;
	isExclusive?: boolean;
}

export function SelectingListItem<T>(
	configuration: SelectingListItemCfg<T>,
	...children: Component<any>[]
) {
	return ListItem(...children)
		.setAccessibilityRole('option')

		.access((self) => {
			const bindingModel = new ValueSBModel<T>({
				component: self,
				selection: configuration.selection,

				getView: () => {
					return self.getAttribute('aria-selected') == 'true';
				},
				setView: (isSelected) => {
					self.setAttr('aria-selected', isSelected);
				},

				isExclusive: configuration.isExclusive ?? true,
				ownValue: configuration.ownValue,

				changeEventName: 'click',
			});

			self.createSelectionBinding(bindingModel);
			self.listen('click', () => {
				const isChecked =
					configuration.isExclusive == true
						? !bindingModel.getView()
						: true;
				bindingModel.setData(isChecked);
			});
		});
}

/* Separator */
export function Separator() {
	return Component('hr').addToClass('separators');
}

/* Sheet */
export interface SheetCfg {
	isOpen: BindableObject<boolean>;
	accessibilityLabel: string;
}

/**
 * Modal, convering entire screen.
 */
export function Sheet(configuration: SheetCfg, ...children: Component<any>[]) {
	return Container(
		'dialog',
		Div(...children)
			.addToClass('sheet-contents')
			.listen('click', (e) => e.stopPropagation())
			.setAccessibilityLabel(configuration.accessibilityLabel)
			.allowKeyboardFocus()
			.focusOnMatch(configuration.isOpen, true),
	)
		.addToClass('sheet-containers')
		.toggleAttr('open', configuration.isOpen)
		.listen('click', () => {
			configuration.isOpen.value = false;
		});
}

/* Slider */
export interface SliderOpts {
	min?: ValueObject<number>;
	max?: ValueObject<number>;
	step?: ValueObject<number>;
}

export function Slider(
	value: BindableObject<number>,
	options: SliderOpts = {},
) {
	return Input<number>({
		type: 'range',
		fallbackValue: 0,
		value,
		placeholder: undefined,
		toValueType: (inputValue) => parseInt(inputValue),
		valueToString: (inputValue) => inputValue.toString(),
	}).access((self) =>
		self
			.setAttr('min', options.min ?? 0)
			.setAttr('max', options.max ?? 100)
			.setAttr('step', options.step ?? 1),
	);
}

/* Spacer */
export function Spacer() {
	return Div().addToClass('spacers');
}

/* Submit */
/**
 * HTML submit input.
 */
export function Submit(text: string) {
	return Component('input')
		.addToClass('submits')

		.setAttr('value', text)
		.setAttr('type', 'submit');
}

/* Text */
export function Text(
	value: ValueObject<Stringifiable>,
	tagName: keyof HTMLElementTagNameMap = 'span',
) {
	return Component(tagName).setText(value);
}

/* Textarea */
export function Textarea(
	value: BindableObject<Stringifiable>,
	placeholder: string,
) {
	return Component<Stringifiable>('textarea')
		.addToClass('textareas')
		.access((self) =>
			self
				.createTightBinding(
					new ValueTBModel({
						component: self,
						data: value,
						fallbackValue: '',
					}),
				)

				.setAttr('placeholder', placeholder),
		);
}

/* VisualGroup */
export function VisualGroup(...children: Component<any>[]) {
	return VStack(...children).addToClass('visual-groups');
}

export function LabeledVisualGroup(
	label: string,
	...children: Component<any>[]
) {
	return VStack(
		Text(label, 'h5').useMutedColor(),
		VStack(...children).addToClass('visual-groups'),
	)
		.useDefaultSpacing()
		.cssJustifyContent('start')
		.cssMarginTop('1rem')
		.cssFlex(0);
}

/* VStack */
/**
 * Vertical stack.
 */
export function VStack(...children: Component<any>[]) {
	return Div(...children).addToClass('stacks-vertical');
}

/*
 * NAVIGATION
 */

/* STAGE-BASED */
/* Scene */
export enum SceneTypes {
	Column = 'scenes-column',
	Content = 'scenes-content',
	Full = 'scenes-full',
	Navigation = 'scenes-navigation',
}

export class GenericScene<T> {
	readonly depth: number;
	readonly stage: Stage;
	readonly view: Component<any>;
	readonly linkSelection = new DataSelection<UUID>();
	accessibilityLabel: string | undefined;
	type: SceneTypes = SceneTypes.Full;

	constructor(depth: number, stage: Stage, data: T) {
		this.depth = depth;
		this.stage = stage;
		this.view = this.generateView(data);

		this.stage.depth.addBinding({
			uuid: new UUID(),
			action: (stageDepth) => {
				if (stageDepth > depth + 1) return; //has child scenes
				this.linkSelection.selectedItems.value = [];
			},
		});
	}

	private generateView(data: T) {
		const main = Div(this.draw(data))
			.addToClass('scenes')
			.addToClass(this.type)
			.setAccessibilityLabel(this.accessibilityLabel ?? '')
			.allowKeyboardFocus()
			.focusOnCreate();

		if (this.accessibilityLabel == undefined)
			console.warn('Scene does not have an accessibilityLabel.', this);

		return main;
	}

	/**
	 * Draws the Scene's UI.
	 */
	draw(data: T): Component<any> {
		return Text('Hello, world!');
	}

	/**
	 * Called after scene is created.
	 */
	setup(data: T): void {}

	/**
	 * Closes scene.
	 */
	close = () => {
		this.stage.goBackTo(this.depth - 1);
	};

	get isOpen() {
		if (!this.view) return false;
		return this.view.parentNode != null;
	}
}

/* Stage */
/**
 * Contains one or multiple Scenes.
 * Layout is determined by Scene types.
 */
export interface Stage extends Component<undefined> {
	depth: State<number>;
	addScene: <T>(
		Scene: typeof GenericScene<T>,
		data: T,
		depth?: number,
	) => this;
	replaceScene: <T>(
		Scene: typeof GenericScene<T>,
		data: T,
		depth: number,
	) => Promise<this>;
	goBackTo: (depth: number, shouldUpdate?: boolean) => Promise<this>;
}

export function Stage<T>(
	initialScene: typeof GenericScene<T>,
	initialSceneData: T,
) {
	return (Div() as Stage).addToClass('stages').access((self) => {
		let persistingChildren: Element[] = [];
		function getPersistingChildren() {
			persistingChildren = Array.from(self.children).filter(
				(child) => !child.classList.contains('animating-out'),
			);
			return persistingChildren;
		}
		function getDepth() {
			return getPersistingChildren().length;
		}
		function updateDepth() {
			const depth = getDepth();
			self.depth.value = depth;
		}

		self.depth = new State(0);

		self.addScene = (Scene, data, depth = getDepth()) => {
			const scene = new Scene(depth, self, data);
			self.addItems(scene.view);
			scene.setup(data);
			scene.view.scrollIntoView();
			return self;
		};

		self.replaceScene = async (Scene, data, depth) => {
			await self.goBackTo(depth - 1, false);
			self.addScene(Scene, data, depth);
			updateDepth();

			return self;
		};

		self.goBackTo = async (depth, shouldUpdate = true) => {
			while (getPersistingChildren().length > depth + 1) {
				const child = persistingChildren[
					persistingChildren.length - 1
				] as Component<any>;
				child.remove()
			}
			if (shouldUpdate) updateDepth();
			return self;
		};

		self.addScene(initialScene, initialSceneData);
	});
}

/* Link */
export interface NavigationLinkCfg<T> {
	parentScene: GenericScene<any>;
	data: T;
	accessibilityLabel: ValueObject<string>;
	destination: typeof GenericScene<T>;
	initiallySelected?: boolean;
}

/**
 * Links to a Scene inside a Stage.
 */
export function SceneLink<T>(
	configuration: NavigationLinkCfg<T>,
	...children: Component<any>[]
) {
	const stage = configuration.parentScene.stage;
	const depth = configuration.parentScene.depth;
	const uuid = new UUID();

	function openScene() {
		stage.replaceScene(
			configuration.destination,
			configuration.data,
			depth + 1,
		);
	}

	if (configuration.initiallySelected == true) {
		configuration.parentScene.linkSelection.selectedItems.value = [uuid];
	}

	const isSelected = new ComputedState({
		statesToBind: [configuration.parentScene.linkSelection.selectedItems],
		initialValue: false,
		compute(self) {
			self.value =
				configuration.parentScene.linkSelection.selectedItems.value.indexOf(
					uuid,
				) > -1;
		},
	});

	return SelectingListItem(
		{
			ownValue: uuid,
			selection: configuration.parentScene.linkSelection,
		},
		HStack(...children),
		Spacer(),
		Icon('chevron_right').cssOpacity(0.6),
	)
		.addToClass('navigation-links')
		.setAccessibilityRole('link')
		.setAccessibilityLabel(configuration.accessibilityLabel)
		.setAccessibilityCurrentState('page', isSelected)
		.allowKeyboardFocus()
		.listen('click', openScene)
		.access((self) =>
			self.registerKeyboardShortcuts(
				{
					key: ' ',
					action: () => self.click(),
				},
				{
					key: 'Enter',
					action: () => self.click(),
				},
				{
					key: 'ArrowRight',
					action: () => self.click(),
				},
			),
		);
}

/* TAB-BASED */
export interface TabCfg {
	iconName: string;
	text: string;
	view: Component<any>;
}

/**
 * Tab-based navigation.
 */
export function TabView(...configuration: TabCfg[]) {
	const visibleTabIndex = new State(0);

	return VStack(
		HStack(
			ButtonGroup(
				...configuration.map((tab, i) =>
					Button({
						iconName: tab.iconName,
						text: tab.text,
						accessibilityLabel: tab.text,
						action: () => (visibleTabIndex.value = i),
					}).access((self) => {
						const isPressed = new ComputedState({
							statesToBind: [visibleTabIndex],
							initialValue: false,
							compute(self) {
								self.value = visibleTabIndex.value == i;
							},
						});

						return self
							.setAccessibilityRole('link')
							.setAccessibilityCurrentState('page', isPressed)
							.addToClassConditionally(
								'buttons-pressed',
								isPressed,
							);
					}),
				),
			).setAccessibilityRole('navigation'),
		).cssFlex(0),
		Div(
			...configuration.map((tab, i) =>
				tab.view
					.setVisibleIfMatch(i, visibleTabIndex)
					.setAccessibilityLabel(tab.text)
					.allowKeyboardFocus()
					.focusOnMatch(visibleTabIndex, i),
			),
		),
	).addToClass('tab-views');
}
