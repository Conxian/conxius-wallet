;; Revenue Distributor Contract (Clarity 4.0)
;; Handles automated distribution of protocol revenue.
;; Aligned with CON-498.

(define-constant ERR-NOT-AUTHORIZED (err u1000))
(define-data-var distribution-owner principal tx-sender)

(define-public (set-owner (new-owner principal))
  (begin
    (asserts! (is-eq tx-sender (var-get distribution-owner)) ERR-NOT-AUTHORIZED)
    (ok (var-set distribution-owner new-owner))
  )
)
