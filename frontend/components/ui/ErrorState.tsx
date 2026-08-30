import React from "react";
import Icon from "@/components/icons";

export function ErrorState({
  title = "We couldn't load this",
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="error-state" role="alert">
      <div className="error-state-icon"><Icon name="alertCircle" size={28} /></div>
      <div className="error-state-title">{title}</div>
      {message && <div className="error-state-desc">{message}</div>}
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
