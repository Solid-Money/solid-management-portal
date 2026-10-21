"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { addInternalTeamMember } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Put someone on the internal team by whatever identifies them to hand — a
 * username from Slack, an email from a tester sign-up, a user id copied from
 * their profile. The backend resolves it and says when it matches nobody or
 * someone already on the team; the input is kept either way, so a typo is
 * corrected rather than retyped.
 */
export default function AddMemberForm() {
  const [user, setUser] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const trimmedUser = user.trim();

  const mutation = useMutation({
    mutationFn: async () =>
      (await addInternalTeamMember(trimmedUser, note.trim() || undefined)).data
        .data,
    onSuccess: (member) => {
      toast.success(
        `${member.username ?? member.userId} added to the internal team`
      );
      setUser("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["internal-team"] });
      void queryClient.invalidateQueries({
        queryKey: ["user-audit-log", member.userId],
      });
    },
    onError: () => {
      // The API layer already surfaces the server's message as a toast — no
      // such user, or already on the team — so this only keeps the input.
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a member</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmedUser && !mutation.isPending) mutation.mutate();
          }}
          className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1.4fr_auto]"
        >
          <div className="grid gap-2">
            <Label htmlFor="internal-team-user">User</Label>
            <Input
              id="internal-team-user"
              value={user}
              onChange={(event) => setUser(event.target.value)}
              placeholder="Username, email or user id"
              spellCheck={false}
              autoComplete="off"
              disabled={mutation.isPending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="internal-team-note">
              Note{" "}
              <span className="font-normal text-gray-500">(optional)</span>
            </Label>
            <Input
              id="internal-team-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Who they are, e.g. QA, or testing Wirex cards"
              maxLength={500}
              disabled={mutation.isPending}
            />
          </div>
          <Button
            type="submit"
            disabled={mutation.isPending || !trimmedUser}
            className="cursor-pointer"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
