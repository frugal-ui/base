import { v4 as uuidv4 } from 'uuid';
export function UUID() {
    return uuidv4();
}

/* REACTIVITY */
// GENERAL
/** Object holding a value. Used by UI components. */
export type ValueObject<T> = T | State<T>;

export function unwrapValue<T>(valueObject: ValueObject<T>) {
    if (valueObject instanceof State) return valueObject.value;
    else return valueObject;
}

// STATE
/** Configures StateResponders. */
export interface StateResponseDetails {
    safeToPropagate: boolean;
}
/** Triggered when bound State changes */
export type StateResponder<T> = (newValue: T, details: StateResponseDetails) => void;
/** Binds a state. Responder triggered when State changes. */
export interface StateBinder<T> {
    uuid: string;
    responder: StateResponder<T>;
}
/** Reactive Variable. Binders will be triggered on change. */
export class State<T> {
    private _value: T;
    private binders = new Map<StateBinder<T>['uuid'], StateBinder<T>['responder']>();

    constructor(value: T) {
        this._value = value;
    }

    /* basic */
    get value() {
        return this._value;
    }

    set value(newValue: T) {
        this._value = newValue;
        this.trigger({
            safeToPropagate: true,
        });
    }

    /* reactivity */
    trigger(options: StateResponseDetails) {
        this.binders.forEach(responder => {
            responder(this.value, options);
        })
    }
    addBinder(binder: StateBinder<T>) {
        this.binders.set(binder.uuid, binder.responder);
    }
    removeBinder(binder: StateBinder<T>) {
        this.binders.delete(binder.uuid);
    }
}

/* COMPONENTS */
// GENERAL

// SPECIFIC