import test from 'node:test';

function assert<T>(a: T, b: T) {
    console.log(a, b);
    if (a != b) throw 'nomatch';
}

import { State, Binding, UUID, unwrapValue, ComputedState, ProxyState } from './index.js';

test('ValueObject', () => {
    const targetValue = 'Hello!';

    const state = new State(targetValue);
    assert(state.value, targetValue);

    assert(unwrapValue(state), targetValue);
    assert(unwrapValue(targetValue), targetValue);
});

test('State & Binding', () => {
    return new Promise(res => {
        const valueA = 'A';
        const valueB = 'B';
        let changedValue = '';

        const state = new State(valueA);
        const binder: Binding<string> = {
            uuid: new UUID(),
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

test('ComputedState', () => {
    const stateA = new State('A');
    const stateB = new ComputedState<string>({
        statesToBind: [stateA],
        initialValue: '',
        compute: (self) => {
            self.value = stateA.value + 'b';
        },
    });

    assert(stateB.value, stateA.value + 'b');
    stateA.value = 'B';
    assert(stateB.value, stateA.value + 'b');
})

test('ProxyState', () => {
    const originalState = new State(true);
    const proxyState = new ProxyState({
        original: originalState,
        convertFromOriginal: (originalValue) => originalValue == true ? 'Yes' : 'No',
        convertToOriginal: (value) => value == 'Yes',
    })

    assert('Yes', proxyState.value);
    originalState.value = false;
    assert('No', proxyState.value);
    proxyState.value = 'Yes';
    assert(true, originalState.value);
})