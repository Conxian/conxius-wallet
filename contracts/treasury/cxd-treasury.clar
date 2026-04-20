;; CXD Treasury Contract (Clarity 4.0)
;; Manages protocol reserves and treasury allocation.
;; Aligned with CON-498.

(define-constant ERR-NOT-AUTHORIZED (err u900))
(define-data-var treasury-manager principal tx-sender)

(define-public (set-manager (new-manager principal))
  (begin
    (asserts! (is-eq tx-sender (var-get treasury-manager)) ERR-NOT-AUTHORIZED)
    (ok (var-set treasury-manager new-manager))
  )
)
