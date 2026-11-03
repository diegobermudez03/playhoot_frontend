// What a game's client asks of the device, read statically from its sources: whether it needs a
// physical keyboard, hovering, or pressing. The SDK's controls (Button, Choices, TextAnswer) work
// with touch, a mouse or a keyboard alike, so they only count as pressing: offering Enter as an
// alternative never makes a game require a keyboard (plan §6). Raw listeners count for what they
// listen to. The backend derives the devices (desktop, mobile or both) from these three answers.
import ts from 'typescript';

export interface InputRequirements {
  usesKeyboard: boolean;
  usesPointerHover: boolean;
  usesPointerPress: boolean;
}

const keyboardEvents = ['keydown', 'keyup', 'keypress'];
const hoverEvents = ['mouseenter', 'mouseover', 'mousemove', 'pointerenter', 'pointerover'];
const pressEvents = [
  'click',
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchend',
];

// JSX handler props name the same events: onKeyDown is keydown.
const propEvent = (prop: string) => prop.slice(2).toLowerCase();

// SDK components and intrinsic elements that are pressed.
const pressedComponents = ['Button', 'Choices', 'TextAnswer'];
const pressedElements = ['button', 'select'];

export function inputRequirements(
  sources: readonly { file: string; text: string }[],
): InputRequirements {
  const found: InputRequirements = {
    usesKeyboard: false,
    usesPointerHover: false,
    usesPointerPress: false,
  };
  const listen = (event: string) => {
    if (keyboardEvents.includes(event)) found.usesKeyboard = true;
    if (hoverEvents.includes(event)) found.usesPointerHover = true;
    if (pressEvents.includes(event)) found.usesPointerPress = true;
  };
  for (const { file, text } of sources) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const sdkComponents = new Set<string>();
    const visit = (node: ts.Node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === '@playhoot/game-react'
      ) {
        const named = node.importClause?.namedBindings;
        if (named && ts.isNamedImports(named)) {
          for (const element of named.elements) {
            const imported = (element.propertyName ?? element.name).text;
            if (pressedComponents.includes(imported)) sdkComponents.add(element.name.text);
          }
        }
      }
      if (
        ts.isJsxAttribute(node) &&
        ts.isIdentifier(node.name) &&
        /^on[A-Z]/.test(node.name.text)
      ) {
        listen(propEvent(node.name.text));
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        if (sdkComponents.has(tag) || pressedElements.includes(tag)) found.usesPointerPress = true;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'addEventListener'
      ) {
        const [type] = node.arguments;
        if (type !== undefined && ts.isStringLiteralLike(type)) listen(type.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}
