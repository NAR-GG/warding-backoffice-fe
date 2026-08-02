import { useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import ImageResize from "tiptap-extension-resize-image";
import { Markdown } from "tiptap-markdown";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Link2,
  List,
  Pilcrow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// 이미지: 코너 드래그로 리사이즈(tiptap-extension-resize-image). 마크다운은 폭을
// 표현할 수 없으므로 alt 뒤에 `|px` 를 실어 나른다 — `![스크린샷|400](url)`.
// 앱 렌더러(notice_detail_screen.dart)도 같은 규칙으로 폭을 해석한다.
export const ResizableImage = ImageResize.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: null,
        // 마크다운에서 온 alt 의 `|px` 꼬리는 폭 정보 — alt 텍스트에선 제거.
        parseHTML: (el) =>
          (el.getAttribute("alt") ?? "").replace(/\|\d+$/, "") || null,
      },
      containerStyle: {
        default: null,
        parseHTML: (el) => {
          const fromAlt = /\|(\d+)$/.exec(el.getAttribute("alt") ?? "")?.[1];
          const width = fromAlt ?? el.getAttribute("width");
          return width
            ? `width: ${width}px; height: auto; cursor: pointer;`
            : el.style.cssText || null;
        },
      },
    };
  },
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (n: unknown) => void },
          node: { attrs: Record<string, string | null> }
        ) {
          const width = /width:\s*([\d.]+)px/.exec(node.attrs.containerStyle ?? "")?.[1];
          const alt = (node.attrs.alt ?? "").replace(/\|\d+$/, "");
          const size = width ? `|${Math.round(Number(width))}` : "";
          state.write(`![${alt}${size}](${node.attrs.src ?? ""})`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

/** 공지 본문 확장 세트 — 앱 렌더러가 지원하는 문법만 허용
 * (버튼뿐 아니라 단축입력 `> `, `1. `, `*기울임*` 도 차단). 조회 페이지도 같은 세트로 렌더. */
export const noticeExtensions = () => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    italic: false,
    strike: false,
    orderedList: false,
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
  }),
  Link.configure({ openOnClick: false }),
  ResizableImage,
  // transformPastedText: 마크다운 텍스트를 붙여넣으면 서식으로 변환 —
  // 평문 붙여넣기 시 ## 이 리터럴(\##)로 저장되는 사고 방지.
  // breaks: 한 줄 개행을 줄바꿈으로 되읽는다 — 저장 시 `\` 를 떼고(notices/form.tsx)
  // 순수 개행으로 내보내므로, 다시 열었을 때 줄바꿈이 공백으로 뭉개지지 않게 하는 짝.
  Markdown.configure({
    linkify: true,
    breaks: true,
    transformPastedText: true,
    transformCopiedText: true,
  }),
];

// 공지 본문 WYSIWYG 에디터 (Orca 스타일: 상단 툴바 + 인라인 렌더링).
// 겉은 리치 에디터지만 저장은 마크다운 문자열 — 앱 렌더러 계약 그대로.
type Props = {
  value: string;
  onChange: (markdown: string) => void;
  uploadImage: (file: File) => Promise<string>;
};

export function NoticeEditor({ value, onChange, uploadImage }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const insertImageFiles = (editor: Editor, files: File[]) => {
    files
      .filter((f) => f.type.startsWith("image/"))
      .forEach((file) => {
        void uploadImage(file).then((url) =>
          editor.chain().focus().setImage({ src: url, alt: file.name }).run()
        );
      });
  };

  const editor = useEditor({
    extensions: noticeExtensions(),
    content: value,
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
    editorProps: {
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])];
        if (files.some((f) => f.type.startsWith("image/"))) {
          if (editor) insertImageFiles(editor, files);
          return true;
        }
        // 마크다운 꼴 텍스트는 HTML 붙여넣기(채팅·웹에서 복사)여도 평문을 md 로 파싱.
        // transformPastedText 는 평문 경로에만 작동해서 이 가드가 없으면 \## 리터럴로 들어간다.
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (/^(#{1,3}\s|[-*]\s|!\[|\d+\.\s)/m.test(text)) {
          // tiptap-markdown 이 insertContent 를 md 파서로 감싸두었다.
          editor?.commands.insertContent(text);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])];
        if (!files.some((f) => f.type.startsWith("image/"))) return false;
        event.preventDefault();
        if (editor) insertImageFiles(editor, files);
        return true;
      },
    },
  });

  if (!editor) return null;

  /// 링크 모달 열기 — 기존 링크 위면 링크 전체로 선택을 넓혀 URL·텍스트를 프리필.
  const openLinkDialog = () => {
    editor.chain().extendMarkRange("link").run();
    const { from, to } = editor.state.selection;
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "https://");
    setLinkLabel(editor.state.doc.textBetween(from, to, " "));
    setLinkOpen(true);
  };

  /// 적용 — 선택 영역(또는 기존 링크)을 새 텍스트+링크로 교체. URL 비우면 해제.
  const applyLink = () => {
    setLinkOpen(false);
    const href = linkUrl.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href === "" || href === "https://") {
      chain.unsetLink().run();
      return;
    }
    chain
      .insertContent({
        type: "text",
        text: linkLabel.trim() === "" ? href : linkLabel.trim(),
        marks: [{ type: "link", attrs: { href } }],
      })
      .run();
  };

  const btn = (
    icon: ReactNode,
    label: string,
    onClick: () => void,
    active = false
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={cn(active && "bg-accent text-accent-foreground")}
      onMouseDown={(e) => e.preventDefault()} // 에디터 포커스 유지
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  const chain = () => editor.chain().focus();

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
        {btn(<Pilcrow className="size-4" />, "본문", () => chain().setParagraph().run(), editor.isActive("paragraph"))}
        {btn(<Heading1 className="size-4" />, "제목 1", () => chain().toggleHeading({ level: 1 }).run(), editor.isActive("heading", { level: 1 }))}
        {btn(<Heading2 className="size-4" />, "제목 2", () => chain().toggleHeading({ level: 2 }).run(), editor.isActive("heading", { level: 2 }))}
        {btn(<Heading3 className="size-4" />, "제목 3", () => chain().toggleHeading({ level: 3 }).run(), editor.isActive("heading", { level: 3 }))}
        <span className="mx-1 h-5 w-px bg-border" />
        {btn(<Bold className="size-4" />, "굵게", () => chain().toggleBold().run(), editor.isActive("bold"))}
        {btn(<List className="size-4" />, "글머리 목록", () => chain().toggleBulletList().run(), editor.isActive("bulletList"))}
        <span className="mx-1 h-5 w-px bg-border" />
        {btn(<Link2 className="size-4" />, "링크", openLinkDialog, editor.isActive("link"))}
        {btn(<ImageIcon className="size-4" />, "이미지", () => fileRef.current?.click())}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (editor) insertImageFiles(editor, [...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      <EditorContent editor={editor} className="notice-editor" />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>링크</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              applyLink();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-label">표시할 텍스트</Label>
              <Input
                id="link-label"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="비우면 URL 그대로 표시"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                취소
              </Button>
              <Button type="submit">적용</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
