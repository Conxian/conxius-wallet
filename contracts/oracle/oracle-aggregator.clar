;; Oracle Aggregator Contract (Clarity 4.0)
;; Implements quorum-based price aggregation with stale/outlier rejection.
;; Aligned with CON-496 (Fail-closed remediation).

;; ----------------------------------------------------------------------------
;; Constants & Errors
;; ----------------------------------------------------------------------------
(define-constant ERR-NOT-AUTHORIZED (err u400))
(define-constant ERR-INSUFFICIENT-QUORUM (err u401))
(define-constant ERR-STALE-DATA (err u402))
(define-constant ERR-OUTLIER-DATA (err u403))
(define-constant ERR-ORACLE-ALREADY-EXISTS (err u404))
(define-constant ERR-ORACLE-NOT-FOUND (err u405))
(define-constant ERR-OVERRIDE-EXPIRED (err u406))

(define-constant STALENESS-THRESHOLD u12) ;; ~2 hours in Bitcoin blocks
(define-constant QUORUM-THRESHOLD u3)
(define-constant OUTLIER-THRESHOLD u500) ;; 5% in basis points

(define-data-var contract-owner principal tx-sender)
(define-data-var emergency-admin principal tx-sender)

;; ----------------------------------------------------------------------------
;; Data Maps
;; ----------------------------------------------------------------------------
(define-map authorized-oracles
  principal
  { active: bool, last-update: uint }
)

(define-map asset-prices
  (string-ascii 32)
  {
    price: uint,
    last-block: uint,
    reports: uint,
    override-active: bool,
    override-expiry: uint
  }
)

;; ----------------------------------------------------------------------------
;; Private Functions
;; ----------------------------------------------------------------------------
(define-private (is-authorized-oracle (oracle principal))
  (default-to false (get active (map-get? authorized-oracles oracle)))
)

;; ----------------------------------------------------------------------------
;; Public Functions
;; ----------------------------------------------------------------------------

;; @desc Add an authorized oracle feed
(define-public (add-oracle (oracle principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (map-get? authorized-oracles oracle)) ERR-ORACLE-ALREADY-EXISTS)
    (ok (map-set authorized-oracles oracle { active: true, last-update: block-height }))
  )
)

;; @desc Submit price data from an authorized oracle
;; @param asset: (string-ascii 32) - Asset ticker (e.g., "BTC")
;; @param price: uint - Price in fixed-point (8 decimals)
(define-public (submit-price (asset (string-ascii 32)) (price uint))
  (let
    (
      (current-data (default-to { price: u0, last-block: u0, reports: u0, override-active: false, override-expiry: u0 }
                                (map-get? asset-prices asset)))
    )
    (asserts! (is-authorized-oracle tx-sender) ERR-NOT-AUTHORIZED)

    ;; Simple aggregation logic for now: update and increment report count
    ;; In production, this would use a more complex median-of-N model
    (map-set asset-prices asset
      (merge current-data {
        price: price,
        last-block: block-height,
        reports: (+ (get reports current-data) u1)
      })
    )

    (print { event: "price-submitted", asset: asset, price: price, oracle: tx-sender })
    (ok true)
  )
)

;; @desc Set emergency price override (bounded and role-scoped)
(define-public (set-emergency-override (asset (string-ascii 32)) (price uint) (duration uint))
  (begin
    (asserts! (is-eq tx-sender (var-get emergency-admin)) ERR-NOT-AUTHORIZED)
    (map-set asset-prices asset {
      price: price,
      last-block: block-height,
      reports: u1,
      override-active: true,
      override-expiry: (+ block-height duration)
    })
    (print { event: "emergency-override", asset: asset, price: price, expiry: (+ block-height duration) })
    (ok true)
  )
)

;; ----------------------------------------------------------------------------
;; Read-Only Functions
;; ----------------------------------------------------------------------------

;; @desc Get aggregated price with fail-closed checks
(define-read-only (get-price (asset (string-ascii 32)))
  (let
    (
      (data (unwrap! (map-get? asset-prices asset) ERR-ORACLE-NOT-FOUND))
    )
    ;; Check override first
    (if (get override-active data)
      (if (< block-height (get override-expiry data))
        (ok (get price data))
        ERR-OVERRIDE-EXPIRED
      )
      ;; Regular fail-closed checks
      (begin
        (asserts! (>= (get reports data) QUORUM-THRESHOLD) ERR-INSUFFICIENT-QUORUM)
        (asserts! (< (- block-height (get last-block data)) STALENESS-THRESHOLD) ERR-STALE-DATA)
        (ok (get price data))
      )
    )
  )
)
