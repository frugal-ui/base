import test from 'node:test';
import assert from 'node:assert';

import { State, StateBinder, UUID, unwrapValue } from './index.js';

test('ValueObject', () => {
    const targetValue = 'Hello!';

    const state = new State(targetValue);
    assert(state.value, targetValue);

    assert(unwrapValue(state), targetValue);
    assert(unwrapValue(targetValue), targetValue);
});

test('Reactivity', () => {
    return new Promise(res => {
        const valueA = 'A';
        const valueB = 'B';
        let changedValue = '';

        const state = new State(valueA);
        const binder: StateBinder<string> = {
            uuid: UUID(),
            responder(newValue) {
                changedValue = newValue;
            }
        }
        state.addBinder(binder);
        state.value = valueB;

        setTimeout(() => {
            assert(unwrapValue(state), valueB);
            res('');
        }, 200)
    })
});