;; Lending Manager Contract (Clarity 4.0)
;; Manages collateralized lending and borrowing with strict solvency checks.
;; Aligned with CON-497 (Lending solvency remediation).

;; ----------------------------------------------------------------------------
;; Constants & Errors
;; ----------------------------------------------------------------------------
(define-constant ERR-NOT-AUTHORIZED (err u600))
(define-constant ERR-INSUFFICIENT-COLLATERAL (err u601))
(define-constant ERR-HEALTH-FACTOR-TOO-LOW (err u602))
(define-constant ERR-INVALID-AMOUNT (err u603))
(define-constant ERR-INSUFFICIENT-LIQUIDITY (err u604))

(define-constant COLLATERAL-RATIO-THRESHOLD u15000) ;; 150.00% in basis points
(define-constant LIQUIDATION-THRESHOLD u11000)      ;; 110.00% in basis points

(define-data-var contract-owner principal tx-sender)

;; ----------------------------------------------------------------------------
;; Data Maps
;; ----------------------------------------------------------------------------
(define-map user-accounts
  principal
  {
    collateral: uint,
    debt: uint,
    last-update: uint
  }
)

(define-data-var total-debt uint u0)

;; ----------------------------------------------------------------------------
;; Private Functions
;; ----------------------------------------------------------------------------
(define-private (calculate-health-factor (collateral uint) (debt uint))
  (if (is-eq debt u0)
    u999999 ;; Infinite health
    (/ (* collateral u10000) debt)
  )
)

;; ----------------------------------------------------------------------------
;; Public Functions
;; ----------------------------------------------------------------------------

;; @desc Deposit collateral
(define-public (deposit (amount uint))
  (let
    (
      (account (default-to { collateral: u0, debt: u0, last-update: u0 } (map-get? user-accounts tx-sender)))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (map-set user-accounts tx-sender
      (merge account {
        collateral: (+ (get collateral account) amount),
        last-update: block-height
      })
    )
    (ok true)
  )
)

;; @desc Borrow against collateral with strict solvency check
(define-public (borrow (amount uint))
  (let
    (
      (account (unwrap! (map-get? user-accounts tx-sender) ERR-NOT-AUTHORIZED))
      (new-debt (+ (get debt account) amount))
      (health-factor (calculate-health-factor (get collateral account) new-debt))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= health-factor COLLATERAL-RATIO-THRESHOLD) ERR-HEALTH-FACTOR-TOO-LOW)

    (map-set user-accounts tx-sender
      (merge account {
        debt: new-debt,
        last-update: block-height
      })
    )
    (var-set total-debt (+ (var-get total-debt) amount))
    (ok true)
  )
)

;; @desc Withdraw collateral (blocked if health factor drops too low)
(define-public (withdraw (amount uint))
  (let
    (
      (account (unwrap! (map-get? user-accounts tx-sender) ERR-NOT-AUTHORIZED))
      (new-collateral (- (get collateral account) amount))
      (health-factor (calculate-health-factor new-collateral (get debt account)))
    )
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= (get collateral account) amount) ERR-INVALID-AMOUNT)
    (asserts! (>= health-factor COLLATERAL-RATIO-THRESHOLD) ERR-HEALTH-FACTOR-TOO-LOW)

    (map-set user-accounts tx-sender
      (merge account {
        collateral: new-collateral,
        last-update: block-height
      })
    )
    (ok true)
  )
)

;; ----------------------------------------------------------------------------
;; Read-Only Functions
;; ----------------------------------------------------------------------------

(define-read-only (get-account (user principal))
  (map-get? user-accounts user)
)

(define-read-only (get-total-debt)
  (var-get total-debt)
)
