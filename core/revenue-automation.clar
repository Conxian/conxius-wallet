;; Revenue Automation Contract (Clarity 4.0)
;; Manages protocol fee extraction (1%) for Conxian ecosystem operations.
;; CON-1427: Fees are routed to cxd-treasury for reserve management.
;; Aligned with Business State v1.9.5

;; ----------------------------------------------------------------------------
;; Constants & Errors
;; ----------------------------------------------------------------------------
(define-constant FEE-BASIS-POINTS u100) ;; 100 bps = 1%
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-AMOUNT (err u101))
(define-constant ERR-TRANSFER-FAILED (err u102))

;; ----------------------------------------------------------------------------
;; Data Variables
;; ----------------------------------------------------------------------------
;; @desc The primary treasury vault for protocol fees (should point to cxd-treasury)
(define-data-var protocol-vault principal tx-sender)
;; @desc The treasury contract principal for accounting cross-calls
(define-data-var treasury-contract principal tx-sender)
(define-data-var contract-owner principal tx-sender)

;; ----------------------------------------------------------------------------
;; Public Functions
;; ----------------------------------------------------------------------------

;; @desc Extracts the 1% protocol fee from a transaction amount.
;; Transfers STX to the protocol vault and notifies treasury accounting.
;; @param amount: uint - The total transaction amount in micro-STX
;; Complexity: $O(1)$
(define-public (extract-protocol-fee (amount uint))
  (let
    (
      (fee (/ (* amount FEE-BASIS-POINTS) u10000))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    ;; Transfer the calculated fee to the protocol vault (treasury)
    (try! (stx-transfer? fee tx-sender (var-get protocol-vault)))

    ;; Notify treasury accounting (best-effort; non-fatal if treasury is unavailable)
    (let ((treasury (var-get treasury-contract)))
      (if (is-eq treasury tx-sender)
        true ;; Skip self-call
        (match (contract-call? treasury deposit-protocol-fee fee)
          success true
          error true ;; Best-effort: fee was already transferred
        )
      )
    )

    (print { event: "fee-extracted", amount: amount, fee: fee, destination: (var-get protocol-vault) })
    (ok fee)
  )
)

;; @desc Update the protocol vault address (Owner only)
(define-public (set-protocol-vault (new-vault principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set protocol-vault new-vault)
    (ok true)
  )
)

;; @desc Update the treasury contract principal (Owner only)
(define-public (set-treasury-contract (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (var-set treasury-contract new-treasury)
    (ok true)
  )
)

;; ----------------------------------------------------------------------------
;; Read-Only Functions
;; ----------------------------------------------------------------------------

;; @desc Returns the estimated fee for a given amount
(define-read-only (get-fee-estimate (amount uint))
  (/ (* amount FEE-BASIS-POINTS) u10000)
)

;; @desc Returns the current protocol vault
(define-read-only (get-protocol-vault)
  (var-get protocol-vault)
)

;; @desc Returns the current treasury contract
(define-read-only (get-treasury-contract)
  (var-get treasury-contract)
)
