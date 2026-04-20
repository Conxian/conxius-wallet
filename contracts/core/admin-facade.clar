;; Admin Facade Contract (Clarity 4.0)
;; Role-based access control for privileged system operations.
;; Aligned with CON-498.

(define-constant ERR-NOT-AUTHORIZED (err u800))

(define-data-var super-admin principal tx-sender)
(define-map operators principal bool)

(define-public (add-operator (op principal))
  (begin
    (asserts! (is-eq tx-sender (var-get super-admin)) ERR-NOT-AUTHORIZED)
    (ok (map-set operators op true))
  )
)

(define-read-only (is-operator (user principal))
  (default-to false (map-get? operators user))
)
