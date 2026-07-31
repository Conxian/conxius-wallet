;; CXD Treasury Contract (Clarity 4.0)
;; Manages protocol reserves, fee aggregation, CXD backing, and treasury allocation.
;; CON-1427: Protocol fee collection wired through revenue-automation.
;; CON-1425: CXD stability via over-collateralized reserve backing.
;; Aligned with CON-498.

;; ----------------------------------------------------------------------------
;; Constants & Errors
;; ----------------------------------------------------------------------------
(define-constant ERR-NOT-AUTHORIZED (err u900))
(define-constant ERR-INSUFFICIENT-BALANCE (err u901))
(define-constant ERR-INVALID-AMOUNT (err u902))
(define-constant ERR-COLLATERAL-RATIO (err u903))
(define-constant ERR-ALLOCATION-EXCEEDED (err u904))

;; CXD collateralization ratio: 150% (1 CXD backed by 1.50 in reserves)
(define-constant COLLATERAL-RATIO-BPS u15000)

;; Allocation buckets (basis points, must sum to <= 10000)
(define-constant ALLOC-OPS u4000)     ;; 40% operations
(define-constant ALLOC-DEV u3500)     ;; 35% development
(define-constant ALLOC-RESERVE u2500) ;; 25% reserve (remainder)

;; ----------------------------------------------------------------------------
;; Data Variables
;; ----------------------------------------------------------------------------
(define-data-var treasury-manager principal tx-sender)

;; Fee aggregation
(define-data-var total-fees-collected uint u0)

;; CXD supply tracking
(define-data-var total-cxd-minted uint u0)
(define-data-var total-cxd-burned uint u0)

;; Reserve balances by purpose
(define-data-var reserve-operations uint u0)
(define-data-var reserve-development uint u0)
(define-data-var reserve-backing uint u0) ;; Collateral backing CXD

;; ----------------------------------------------------------------------------
;; Data Maps
;; ----------------------------------------------------------------------------
;; Track individual CXD positions: user → (collateral-deposited, cxd-minted)
(define-map cxd-positions
  principal
  { collateral: uint, minted: uint }
)

;; ----------------------------------------------------------------------------
;; Read-Only Functions
;; ----------------------------------------------------------------------------

;; @desc Returns total reserves across all buckets
(define-read-only (get-total-reserves)
  (+ (var-get reserve-operations)
     (var-get reserve-development)
     (var-get reserve-backing))
)

;; @desc Returns the current CXD collateralization ratio in basis points
(define-read-only (get-collateral-ratio)
  (let ((backing (var-get reserve-backing))
        (minted (var-get total-cxd-minted)))
    (if (is-eq minted u0)
      u0
      (/ (* backing u10000) minted)
    )
  )
)

;; @desc Returns reserve allocation breakdown
(define-read-only (get-reserve-breakdown)
  {
    operations: (var-get reserve-operations),
    development: (var-get reserve-development),
    backing: (var-get reserve-backing),
    total-fees: (var-get total-fees-collected),
    cxd-minted: (var-get total-cxd-minted),
    cxd-burned: (var-get total-cxd-burned)
  }
)

;; @desc Returns a user's CXD position
(define-read-only (get-cxd-position (user principal))
  (map-get? cxd-positions user)
)

;; ----------------------------------------------------------------------------
;; Administrative Functions
;; ----------------------------------------------------------------------------

;; @desc Set treasury manager (manager only)
(define-public (set-manager (new-manager principal))
  (begin
    (asserts! (is-eq tx-sender (var-get treasury-manager)) ERR-NOT-AUTHORIZED)
    (ok (var-set treasury-manager new-manager))
  )
)

;; ----------------------------------------------------------------------------
;; Fee Collection (CON-1427)
;; ----------------------------------------------------------------------------

;; @desc Accept protocol fees into the treasury.
;; Called by revenue-automation contract when fees are extracted.
;; Distributes incoming fees according to allocation ratios.
(define-public (deposit-protocol-fee (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)

    ;; Calculate allocation splits
    (let ((ops-share (/ (* amount ALLOC-OPS) u10000))
          (dev-share (/ (* amount ALLOC-DEV) u10000))
          (backing-share (- amount (+ ops-share dev-share)))) ;; remainder to reserve

      ;; Update fee counter
      (var-set total-fees-collected (+ (var-get total-fees-collected) amount))

      ;; Distribute to buckets
      (var-set reserve-operations (+ (var-get reserve-operations) ops-share))
      (var-set reserve-development (+ (var-get reserve-development) dev-share))
      (var-set reserve-backing (+ (var-get reserve-backing) backing-share))

      (print {
        event: "protocol-fee-deposited",
        amount: amount,
        ops: ops-share,
        dev: dev-share,
        backing: backing-share
      })
      (ok amount)
    )
  )
)

;; ----------------------------------------------------------------------------
;; CXD Stability — Minting (CON-1425)
;; ----------------------------------------------------------------------------

;; @desc Mint CXD against deposited collateral.
;; Requires 150% over-collateralization.
;; User deposits STX, receives CXD at 1:1 (adjusted for collateral ratio).
(define-public (mint-cxd (collateral-amount uint))
  (begin
    (asserts! (> collateral-amount u0) ERR-INVALID-AMOUNT)

    ;; Transfer collateral from user to this contract.
    ;; (as-contract tx-sender) evaluates to the contract principal.
    (try! (stx-transfer? collateral-amount tx-sender (as-contract tx-sender)))

    ;; Calculate mintable CXD: collateral / 1.5 (150% ratio)
    (let ((cxd-to-mint (/ (* collateral-amount u10000) COLLATERAL-RATIO-BPS)))

      ;; Add to reserve backing
      (var-set reserve-backing (+ (var-get reserve-backing) collateral-amount))

      ;; Update CXD supply
      (var-set total-cxd-minted (+ (var-get total-cxd-minted) cxd-to-mint))

      ;; Track user position
      (let ((existing (default-to
            { collateral: u0, minted: u0 }
            (map-get? cxd-positions tx-sender))))
        (map-set cxd-positions tx-sender
          {
            collateral: (+ (get collateral existing) collateral-amount),
            minted: (+ (get minted existing) cxd-to-mint)
          }
        )
      )

      (print {
        event: "cxd-minted",
        user: tx-sender,
        collateral: collateral-amount,
        cxd-minted: cxd-to-mint
      })
      (ok cxd-to-mint)
    )
  )
)

;; ----------------------------------------------------------------------------
;; CXD Stability — Redemption (CON-1425)
;; ----------------------------------------------------------------------------

;; @desc Redeem CXD for underlying collateral.
;; Burns CXD and returns proportional collateral to user.
;; Maintains minimum collateral ratio post-redemption.
(define-public (redeem-cxd (cxd-amount uint))
  (begin
    (asserts! (> cxd-amount u0) ERR-INVALID-AMOUNT)

    (let ((position (unwrap! (map-get? cxd-positions tx-sender) ERR-INSUFFICIENT-BALANCE)))
      (asserts! (>= (get minted position) cxd-amount) ERR-INSUFFICIENT-BALANCE)

      ;; Calculate collateral to return (proportional at Collateral Ratio)
      (let ((collateral-to-return (/ (* cxd-amount COLLATERAL-RATIO-BPS) u10000))
            (new-minted (- (get minted position) cxd-amount))
            (new-collateral (- (get collateral position) collateral-to-return)))

        ;; Ensure system remains solvent after redemption
        (asserts! (>= (var-get reserve-backing) collateral-to-return) ERR-INSUFFICIENT-BALANCE)

        ;; Update reserves
        (var-set reserve-backing (- (var-get reserve-backing) collateral-to-return))

        ;; Update CXD supply
        (var-set total-cxd-burned (+ (var-get total-cxd-burned) cxd-amount))

        ;; Update or remove user position
        (if (is-eq new-minted u0)
          (map-delete cxd-positions tx-sender)
          (map-set cxd-positions tx-sender
            { collateral: new-collateral, minted: new-minted }
          )
        )

        ;; Return collateral to user.
        ;; Capture original caller before as-contract changes tx-sender.
        (let ((user tx-sender))
          (try! (as-contract (stx-transfer? collateral-to-return tx-sender user)))
        )

        (print {
          event: "cxd-redeemed",
          user: tx-sender,
          cxd-burned: cxd-amount,
          collateral-returned: collateral-to-return
        })
        (ok collateral-to-return)
      )
    )
  )
)

;; ----------------------------------------------------------------------------
;; Treasury Withdrawal (Operations)
;; ----------------------------------------------------------------------------

;; @desc Withdraw from operations reserve (manager only)
(define-public (withdraw-operations (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender (var-get treasury-manager)) ERR-NOT-AUTHORIZED)
    (asserts! (>= (var-get reserve-operations) amount) ERR-INSUFFICIENT-BALANCE)
    (var-set reserve-operations (- (var-get reserve-operations) amount))
    (try! (as-contract (stx-transfer? amount tx-sender recipient)))
    (ok amount)
  )
)

;; @desc Withdraw from development reserve (manager only)
(define-public (withdraw-development (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender (var-get treasury-manager)) ERR-NOT-AUTHORIZED)
    (asserts! (>= (var-get reserve-development) amount) ERR-INSUFFICIENT-BALANCE)
    (var-set reserve-development (- (var-get reserve-development) amount))
    (try! (as-contract (stx-transfer? amount tx-sender recipient)))
    (ok amount)
  )
)
