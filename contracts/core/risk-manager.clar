;; Risk Manager Contract (Clarity 4.0)
;; Centralized risk policy and health-factor logic.
;; Aligned with CON-498 and CON-499.

;; ----------------------------------------------------------------------------
;; Constants & Errors
;; ----------------------------------------------------------------------------
(define-constant ERR-NOT-AUTHORIZED (err u700))

;; Roles
(define-data-var admin-principal principal tx-sender)

;; ----------------------------------------------------------------------------
;; Public Functions
;; ----------------------------------------------------------------------------

;; @desc Update the authorized admin (replaces tautological checks)
(define-public (set-admin (new-admin principal))
  (begin
    ;; Hardened check: tx-sender must match current admin-principal
    (asserts! (is-eq tx-sender (var-get admin-principal)) ERR-NOT-AUTHORIZED)
    (ok (var-set admin-principal new-admin))
  )
)

;; @desc Calculate canonical health factor for all modules
(define-read-only (calculate-canonical-health (collateral uint) (debt uint))
  (if (is-eq debt u0)
    u999999
    (/ (* collateral u10000) debt)
  )
)

(define-read-only (is-liquidatable (collateral uint) (debt uint))
  (< (calculate-canonical-health collateral debt) u11000)
)
