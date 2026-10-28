"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  /** The card's title, so the fallback still says what is missing. */
  title: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * Keeps one referral v4 card from taking the whole user page down.
 *
 * These cards read endpoints that ship alongside this portal rather than
 * before it; if one answers in a shape this build doesn't expect, the card
 * says so and every other card on the page keeps working.
 */
export class CardErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.title}] failed to render:`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-gray-400" />
            {this.props.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500">
            This card couldn&apos;t be shown — the backend&apos;s answer
            didn&apos;t match what this portal expects. The rest of the page is
            unaffected.
          </p>
        </CardContent>
      </Card>
    );
  }
}

export default CardErrorBoundary;
