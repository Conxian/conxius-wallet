;; Referral Aggregator Contract (Clarity 4.0)
;; Implements the Conxian "5-5-5" Referral Logic:
;; - 5% Discount for the new user
;; - 5% Kickback for the referrer
;; - 5% Treasury contribution (from service spread)

;; ----------------------------------------------------------------------------
;; Data Maps
;; ----------------------------------------------------------------------------
(define-map referrers
  { code: (string-ascii 10) }
  {
    address: principal,
    total-referrals: uint,
    total-earned: uint,
    active: bool
  }
)

;; ----------------------------------------------------------------------------
;; Constants & Errors
;; ----------------------------------------------------------------------------
(define-constant ERR-NOT-AUTHORIZED (err u400))
(define-constant ERR-CODE-EXISTS (err u401))
(define-constant ERR-CODE-NOT-FOUND (err u402))
(define-constant TREASURY 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE)

(define-data-var contract-owner principal tx-sender)

;; ----------------------------------------------------------------------------
;; Public Functions
;; ----------------------------------------------------------------------------

;; @desc Create a new referral code
(define-public (register-referrer (code (string-ascii 10)))
  (begin
    (asserts! (is-none (map-get? referrers { code: code })) ERR-CODE-EXISTS)
    (map-set referrers
      { code: code }
      {
        address: tx-sender,
        total-referrals: u0,
        total-earned: u0,
        active: true
      }
    )
    (ok true)
  )
)

;; @desc Process a transaction with a referral code (5-5-5 Logic)
;; @param code: (string-ascii 10) - The referral code used
;; @param amount: uint - The base transaction amount
(define-public (apply-referral (code (string-ascii 10)) (amount uint))
  (let
    (
      (ref-data (unwrap! (map-get? referrers { code: code }) ERR-CODE-NOT-FOUND))
      (kickback (/ (* amount u5) u100))
      (treasury-cut (/ (* amount u5) u100))
    )
    (asserts! (get active ref-data) ERR-CODE-NOT-FOUND)

    ;; 1. Update Referrer Stats
    (map-set referrers
      { code: code }
      (merge ref-data {
        total-referrals: (+ (get total-referrals ref-data) u1),
        total-earned: (+ (get total-earned ref-data) kickback)
      })
    )

    ;; 2. Transfer Fees (Simplified for this recovery)
    (try! (stx-transfer? kickback tx-sender (get address ref-data)))
    (try! (stx-transfer? treasury-cut tx-sender TREASURY))

    (print { event: "referral-applied", code: code, amount: amount, kickback: kickback })
    (ok kickback)
  )
)

;; ----------------------------------------------------------------------------
;; Read-Only Functions
;; ----------------------------------------------------------------------------

(define-read-only (get-referrer-stats (code (string-ascii 10)))
  (map-get? referrers { code: code })
)
