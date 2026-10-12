import test from "node:test";
import assert from "node:assert/strict";
import {
  findDialogEnterAction,
  shouldUseDialogEnter,
} from "../lib/keyboard-shortcuts.mjs";

function target({ tagName = "DIV", type, closestMatches = [] } = {}) {
  return {
    tagName,
    type,
    closest(selector) {
      if (selector === "input" && tagName === "INPUT") return this;
      return closestMatches.some(
        (match) =>
          selector.includes(match) ||
          (match.startsWith("[contenteditable") &&
            selector.includes("[contenteditable]")),
      )
        ? this
        : null;
    },
  };
}

const enter = { key: "Enter" };

test("Enter can confirm from a dialog panel or text input", () => {
  assert.equal(shouldUseDialogEnter(enter, target()), true);
  assert.equal(shouldUseDialogEnter(enter, target({ tagName: "INPUT", type: "text" })), true);
});

test("Enter is left to native controls and editable text areas", () => {
  for (const selector of [
    "button",
    "a[href]",
    "select",
    "textarea",
    '[contenteditable="true"]',
    "[contenteditable]",
    '[contenteditable="plaintext-only"]',
    '[role="textbox"]',
    '[data-enter-shortcut="off"]',
  ]) {
    assert.equal(
      shouldUseDialogEnter(enter, target({ closestMatches: [selector] })),
      false,
      selector,
    );
  }
  assert.equal(shouldUseDialogEnter(enter, target({ tagName: "INPUT", type: "checkbox" })), false);
});

test("Enter is ignored for composition, repeats, modifiers, and handled events", () => {
  for (const event of [
    { key: "Escape" },
    { ...enter, defaultPrevented: true },
    { ...enter, repeat: true },
    { ...enter, isComposing: true },
    { ...enter, keyCode: 229 },
    { ...enter, shiftKey: true },
    { ...enter, ctrlKey: true },
    { ...enter, altKey: true },
    { ...enter, metaKey: true },
  ]) {
    assert.equal(shouldUseDialogEnter(event, target()), false);
  }
});

test("dialog Enter prefers its primary action and never falls back from a disabled primary", () => {
  const primary = { disabled: false };
  const cancel = { disabled: false };
  const primaryDialog = {
    querySelector: () => primary,
    querySelectorAll: () => [cancel],
  };
  assert.equal(findDialogEnterAction(primaryDialog), primary);

  const disabledPrimaryDialog = {
    querySelector: () => ({ disabled: true }),
    querySelectorAll: () => [cancel],
  };
  assert.equal(findDialogEnterAction(disabledPrimaryDialog), null);
});

test("dialog Enter falls back to the last enabled action when no primary is marked", () => {
  const buttons = [{ disabled: false }, { disabled: false }];
  const dialog = {
    querySelector: () => null,
    querySelectorAll: () => buttons,
  };
  assert.equal(findDialogEnterAction(dialog), buttons[1]);
});
