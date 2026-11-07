"use client";

import type { CommentSort, EpisodeComment, EpisodeCommentReply } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatDate } from "@/shared/lib";
import { Badge, Button, Notice, TextAreaField } from "@/shared/ui";
import { addComment, deleteComment, setCommentLike } from "../api/actions";
import styles from "./episode-comments.module.scss";

interface Props {
  episodeId: string;
  path: string;
  comments: EpisodeComment[];
  total: number;
  loggedIn: boolean;
  sort?: CommentSort;
}

const SORT_LABEL: Record<CommentSort, string> = { latest: "최신순", likes: "공감순" };

interface ItemContext {
  episodeId: string;
  path: string;
  loggedIn: boolean;
  /** 지운 뒤 초점을 옮길 곳. 누른 버튼이 사라진다(KWCAG 6.1.2). */
  focusHeading: () => void;
}

function LikeButton({ comment, context }: { comment: EpisodeCommentReply; context: ItemContext }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const like = useMutation({
    mutationFn: async (liked: boolean) => {
      const result = await setCommentLike(comment.id, liked, context.path);
      if (!result.ok) throw new Error(result.message);
    },
    // 새 수를 받을 때까지 막아 같은 값을 다시 보내지 않게 한다.
    onSuccess: () => startRefresh(() => router.refresh()),
  });
  const busy = like.isPending || refreshing;
  if (!context.loggedIn) return <span className={styles.likes}>공감 {comment.likeCount}</span>;
  return (
    <>
      <Button
        variant="ghost"
        small
        aria-pressed={comment.likedByMe}
        aria-disabled={busy}
        aria-label={`공감 ${comment.likeCount}: ${comment.authorName}의 글`}
        onClick={() => {
          if (!busy) like.mutate(!comment.likedByMe);
        }}
      >
        {comment.likedByMe ? "✓ " : ""}공감 {comment.likeCount}
      </Button>
      {like.error && <Notice tone="error">{like.error.message}</Notice>}
    </>
  );
}

function CommentBody({
  comment,
  context,
  kind,
  actions,
}: {
  comment: EpisodeCommentReply;
  context: ItemContext;
  kind: "댓글" | "답글";
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const result = await deleteComment(commentId, context.path);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      // 누른 버튼이 사라지고 목록도 없어질 수 있으므로 항상 남아 있는 제목으로 초점을 옮긴다.
      context.focusHeading();
      router.refresh();
    },
  });
  return (
    <>
      <div className={styles.meta}>
        <span>
          <strong>{comment.authorName}</strong> {comment.isAuthor && <Badge solid>작가</Badge>} ·{" "}
          {formatDate(comment.createdAt)}
        </span>
      </div>
      <p className={styles.body}>{comment.body}</p>
      <div className={styles.actions}>
        <LikeButton comment={comment} context={context} />
        {actions}
        {comment.canDelete && (
          <Button
            variant="secondary"
            small
            aria-disabled={remove.isPending}
            aria-label={`삭제: ${comment.authorName}의 ${kind}`}
            onClick={() => {
              if (!remove.isPending) remove.mutate(comment.id);
            }}
          >
            삭제
          </Button>
        )}
      </div>
      {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
    </>
  );
}

function ReplyForm({
  parentId,
  context,
  onDone,
  onCancel,
}: {
  parentId: string;
  context: ItemContext;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const add = useMutation({
    mutationFn: async (text: string) => {
      const result = await addComment(context.episodeId, text, context.path, parentId);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      onDone();
      router.refresh();
    },
  });
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!add.isPending) add.mutate(body);
      }}
    >
      <TextAreaField
        label="답글 쓰기"
        value={body}
        maxLength={500}
        required
        rows={2}
        // 답글 버튼을 눌러 연 칸이므로 바로 쓸 수 있게 초점을 준다(KWCAG 7.2.1의 사용자 요구에 따른 이동).
        autoFocus
        error={add.error?.message}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className={styles.actions}>
        <Button type="submit" small aria-disabled={add.isPending}>
          {add.isPending ? "등록 중…" : "답글 등록"}
        </Button>
        <Button type="button" variant="ghost" small onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

function CommentItem({ comment, context }: { comment: EpisodeComment; context: ItemContext }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeForm = () => {
    setReplyingTo(null);
    // 폼이 사라지므로 연 버튼으로 초점을 돌린다.
    requestAnimationFrame(() => openerRef.current?.focus());
  };
  const replyButton = (target: EpisodeCommentReply) =>
    context.loggedIn && (
      <Button
        variant="ghost"
        small
        aria-expanded={replyingTo === target.id}
        aria-label={`답글: ${target.authorName}의 글`}
        onClick={(event) => {
          openerRef.current = event.currentTarget;
          setReplyingTo((current) => (current === target.id ? null : target.id));
        }}
      >
        답글
      </Button>
    );

  return (
    <li className={styles.item}>
      {comment.deleted ? (
        <p className={styles.deleted}>삭제된 댓글입니다.</p>
      ) : (
        <CommentBody comment={comment} context={context} kind="댓글" actions={replyButton(comment)} />
      )}
      {replyingTo === comment.id && (
        <ReplyForm parentId={comment.id} context={context} onDone={closeForm} onCancel={closeForm} />
      )}
      {comment.replies.length > 0 && (
        <ul className={styles.replies} aria-label={`답글 ${comment.replies.length}개`}>
          {comment.replies.map((reply) => (
            <li key={reply.id} className={styles.reply}>
              <CommentBody comment={reply} context={context} kind="답글" actions={replyButton(reply)} />
              {replyingTo === reply.id && (
                <ReplyForm parentId={reply.id} context={context} onDone={closeForm} onCancel={closeForm} />
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function EpisodeComments({ episodeId, path, comments, total, loggedIn, sort = "latest" }: Props) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [body, setBody] = useState("");

  const add = useMutation({
    mutationFn: async (text: string) => {
      const result = await addComment(episodeId, text, path);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      setBody("");
      router.refresh();
    },
  });

  const context: ItemContext = {
    episodeId,
    path,
    loggedIn,
    focusHeading: () => headingRef.current?.focus({ preventScroll: true }),
  };

  return (
    <section className={styles.section} aria-label="댓글">
      <h2 ref={headingRef} className={styles.title} tabIndex={-1}>
        댓글 {total}개
      </h2>
      {comments.length >= 100 && <p className={styles.more}>{SORT_LABEL[sort]}으로 100개까지 보여 줍니다.</p>}
      {loggedIn ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            if (!add.isPending) add.mutate(body);
          }}
        >
          <TextAreaField
            label="댓글 쓰기"
            value={body}
            maxLength={500}
            required
            rows={3}
            error={add.error?.message}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button type="submit" aria-disabled={add.isPending}>
            {add.isPending ? "등록 중…" : "등록"}
          </Button>
        </form>
      ) : (
        <p>
          <Link href={`/login?next=${encodeURIComponent(path)}`}>로그인</Link>하면 댓글을 쓸 수 있습니다.
        </p>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: 입력 요소가 아닌 링크 묶음이라 fieldset이 맞지 않는다. */}
      <div className={styles.sorts} role="group" aria-label="댓글 정렬">
        {(Object.keys(SORT_LABEL) as CommentSort[]).map((key) => (
          <Link
            key={key}
            // 정렬만 바꾸는 것이므로 읽던 위치에 머문다.
            scroll={false}
            href={key === "latest" ? path : `${path}?commentSort=${key}`}
            aria-current={sort === key ? "true" : undefined}
          >
            {sort === key ? `✓ ${SORT_LABEL[key]}` : SORT_LABEL[key]}
          </Link>
        ))}
      </div>
      {comments.length === 0 ? (
        <p>첫 댓글을 남겨 보세요.</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} context={context} />
          ))}
        </ul>
      )}
    </section>
  );
}
