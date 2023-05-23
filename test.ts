import test from 'node:test';
import assert from 'node:assert';

import { State, Binding, UUID, unwrapValue } from './index.js';

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
        const binder: Binding<string> = {
            uuid: UUID(),
            action(newValue) {
                changedValue = newValue;
            }
        }
        state.addBinding(binder);
        state.value = valueB;

        setTimeout(() => {
            assert(unwrapValue(state), valueB);
            res('');
        }, 200)
    })
});