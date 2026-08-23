import React, { useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function renderKaTeX(latex, displayMode = false) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      trust: true,
      strict: false,
    });
  } catch {
    return null;
  }
}

function serializeContent(editor) {
  if (!editor) return '';
  const json = editor.getJSON();
  const parts = [];
  for (const block of json.content || []) {
    if (block.content) {
      for (const node of block.content) {
        if (node.type === 'mathInline') {
          parts.push(`$${node.attrs.latex}$`);
        } else if (node.type === 'text') {
          parts.push(node.text);
        }
      }
    }
    parts.push('\n');
  }
  return parts.join('').replace(/\n+$/, '');
}

function parseToEditorContent(text) {
  if (!text) return [{ type: 'paragraph' }];
  const lines = text.split('\n');
  return lines.map((line) => {
    const nodes = [];
    let remaining = line;
    while (remaining.length > 0) {
      const dollarIdx = remaining.indexOf('$');
      if (dollarIdx === -1) {
        if (remaining) nodes.push({ type: 'text', text: remaining });
        break;
      }
      if (dollarIdx > 0) {
        nodes.push({ type: 'text', text: remaining.substring(0, dollarIdx) });
      }
      const isDouble = remaining.substring(dollarIdx, dollarIdx + 2) === '$$';
      const searchFrom = dollarIdx + (isDouble ? 2 : 1);
      const endMarker = isDouble ? '$$' : '$';
      const endIdx = remaining.indexOf(endMarker, searchFrom);
      if (endIdx === -1) {
        nodes.push({ type: 'text', text: remaining.substring(dollarIdx) });
        break;
      }
      const latex = remaining.substring(dollarIdx + (isDouble ? 2 : 1), endIdx);
      nodes.push({ type: 'mathInline', attrs: { latex, display: isDouble } });
      remaining = remaining.substring(endIdx + (isDouble ? 2 : 1));
    }
    return { type: 'paragraph', content: nodes.length > 0 ? nodes : undefined };
  });
}

const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: '' }, display: { default: false } };
  },
  parseHTML() {
    return [{ tag: 'span[data-math]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { 'data-math': '', ...HTMLAttributes }];
  },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'math-inline-node';
      dom.contentEditable = 'false';
      dom.style.cssText = 'cursor:pointer;padding:0 2px;border-radius:4px;display:inline-block;vertical-align:baseline;transition:background-color 0.15s';
      const html = renderKaTeX(node.attrs.latex, node.attrs.display);
      dom.innerHTML = html || `$${node.attrs.latex}$`;
      if (!html) dom.style.color = '#ef4444';
      dom.addEventListener('mouseenter', () => { dom.style.backgroundColor = 'rgba(59,130,246,0.08)'; });
      dom.addEventListener('mouseleave', () => { dom.style.backgroundColor = 'transparent'; });
      return {
        dom,
        update: (updatedNode) => {
          const newHtml = renderKaTeX(updatedNode.attrs.latex, updatedNode.attrs.display);
          dom.innerHTML = newHtml || `$${updatedNode.attrs.latex}$`;
          dom.style.color = newHtml ? '' : '#ef4444';
          return true;
        },
      };
    };
  },
});

const MathEditor = forwardRef(function MathEditor({ value, onChange, placeholder, className = '', style = {} }, ref) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const skipNextUpdate = useRef(false);

  const styleString = typeof style === 'string'
    ? style
    : Object.entries(style || {})
        .map(([key, val]) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}:${val}`)
        .join(';');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, blockquote: false, codeBlock: false, horizontalRule: false }),
      Placeholder.configure({ placeholder: placeholder || 'Type your question here...' }),
      MathInline,
    ],
    content: { type: 'doc', content: parseToEditorContent(value || '') },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[6rem] px-3 py-2.5 text-sm text-slate-800 ${className}`,
        style: styleString,
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (skipNextUpdate.current) { skipNextUpdate.current = false; return; }
      const text = serializeContent(ed);
      if (onChangeRef.current) onChangeRef.current(text);
    },
  });

  useImperativeHandle(ref, () => ({
    insertMath: (latex) => {
      if (!editor) return;
      editor.chain().focus()
        .insertContent({ type: 'mathInline', attrs: { latex, display: false } })
        .insertContent(' ')
        .run();
    },
    focus: () => editor?.commands.focus(),
  }));

  useEffect(() => () => editor?.destroy(), [editor]);

  return <EditorContent editor={editor} />;
});

export default MathEditor;
