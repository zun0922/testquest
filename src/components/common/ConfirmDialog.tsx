// 確認ダイアログ（FR-001 上書き確認・PauseMenu 中断確認で共用）。設計書§4。
import Button from './Button'

interface Props {
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  confirmTestId?: string
}

export default function ConfirmDialog({
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  onConfirm,
  onCancel,
  confirmTestId,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/66 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-surface border border-line rounded-xl p-6 max-w-sm mx-4">
        <p className="text-text-main mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" onClick={onConfirm} data-testid={confirmTestId}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
