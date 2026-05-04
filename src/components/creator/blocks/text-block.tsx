"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link2,
  Heading2,
  Heading3,
  Quote,
} from "lucide-react";

interface TextBlockContent {
  html: string;
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`rounded p-1.5 text-sm transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function TextBlockEditor({
  content,
  onChange,
}: {
  content: TextBlockContent;
  onChange: (c: TextBlockContent) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write your lesson content here…" }),
    ],
    content: content.html || "",
    onUpdate: ({ editor }) => {
      onChange({ html: editor.getHTML() });
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] p-4 prose prose-slate prose-sm max-w-none focus:outline-none text-slate-800",
      },
    },
  });

  if (!editor) return null;

  function setLink() {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Add Link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

export function TextBlockPreview({ content }: { content: TextBlockContent }) {
  return (
    <div className="prose prose-slate prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: content.html }} />
  );
}
