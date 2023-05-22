/* REACTIVITY */
// GENERAL
export type ValueObject<T> = T | State<T>;

function unwrapValue<T>(valueObject: ValueObject<T>) {
    if (valueObject instanceof State) return valueObject.value;
    else return valueObject;
}

// STATE
export class State<T> {
    private _value: T;

    constructor(value: T) {
        this._value = value;
    }

    /* basic */
    get value() {
        return this._value;
    }
}

/* COMPONENTS */
// GENERAL

// SPECIFIC