"use client";

import type { EpisodeComment } from "@raon/contracts";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatDate } from "@/shared/lib";
import { Button, Notice, TextAreaField } from "@/shared/ui";
import { addComment, deleteComment } from "../api/actions";
import styles from "./episode-comments.module.scss";

interface Props {
  episodeId: string;
  path: string;
  comments: EpisodeComment[];
  loggedIn: boolean;
}

export function EpisodeComments({ episodeId, path, comments, loggedIn }: Props) {
  const router = useRouter();
  const listRef = useRef<HTMLUListElement>(null);
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

  const remove = useMutation({
    mutationFn: async (commentId: string) => {
      const result = await deleteComment(commentId, path);
      if (!result.ok) throw new Error(result.message);
    },
    onSuccess: () => {
      // 누른 버튼이 사라지므로 초점을 목록으로 옮긴다.
      listRef.current?.focus({ preventScroll: true });
      router.refresh();
    },
  });

  return (
    <section className={styles.section} aria-label="댓글">
      <h2 className={styles.title}>댓글 {comments.length}개</h2>
      {loggedIn ? (
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate(body);
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
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? "등록 중…" : "등록"}
          </Button>
        </form>
      ) : (
        <p>
          <Link href={`/login?next=${encodeURIComponent(path)}`}>로그인</Link>하면 댓글을 쓸 수 있습니다.
        </p>
      )}
      {remove.error && <Notice tone="error">{remove.error.message}</Notice>}
      {comments.length === 0 ? (
        <p>첫 댓글을 남겨 보세요.</p>
      ) : (
        <ul ref={listRef} className={styles.list} tabIndex={-1}>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.item}>
              <div className={styles.meta}>
                <span>
                  <strong>{comment.authorName}</strong> · {formatDate(comment.createdAt)}
                </span>
                {comment.canDelete && (
                  <Button
                    variant="secondary"
                    small
                    disabled={remove.isPending}
                    aria-label={`삭제: ${comment.authorName}의 댓글`}
                    onClick={() => remove.mutate(comment.id)}
                  >
                    삭제
                  </Button>
                )}
              </div>
              <p className={styles.body}>{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
