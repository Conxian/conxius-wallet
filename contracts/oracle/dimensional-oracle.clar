;; Dimensional Oracle (Clarity 4.0)
;; Specific oracle implementation for dimensional asset types.
;; Aligned with CON-496.

(define-constant ERR-NOT-AUTHORIZED (err u500))

(define-data-var aggregator-contract principal .oracle-aggregator)

;; @desc Update the parent aggregator principal
(define-public (set-aggregator (new-aggregator principal))
  (begin
    ;; Only placeholder logic for authorization
    (asserts! (is-eq tx-sender (var-get contract-owner-proxy)) ERR-NOT-AUTHORIZED)
    (ok (var-set aggregator-contract new-aggregator))
  )
)

(define-data-var contract-owner-proxy principal tx-sender)

;; @desc Proxy price submission to the aggregator
(define-public (report-price (asset (string-ascii 32)) (price uint))
  (contract-call? .oracle-aggregator submit-price asset price)
)
