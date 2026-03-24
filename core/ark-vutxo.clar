;; Ark V-UTXO Contract (Clarity 4.0)
;; Optimized for Conclave On-Device signing patterns
;; Grounded in Sovereign Bridge Strategy: Native VTXO Lifecycle

;; ----------------------------------------------------------------------------
;; Traits
;; ----------------------------------------------------------------------------
(define-trait sovereign-signer-trait
  (
    (verify-signature (buff 32) (buff 65) (buff 33) (response bool uint))
  )
)

;; ----------------------------------------------------------------------------
;; Data Maps & Vars
;; ----------------------------------------------------------------------------
;; @desc Map to track off-chain Virtual UTXOs (VTXOs)
;; Complexity: $O(1)$
(define-map vutxos
  { id: (buff 32) }
  {
    amount: uint,
    owner: principal,
    owner-pubkey: (buff 33),
    server-pubkey: (buff 33),
    status: (string-ascii 20),
    expiry: uint
  }
)

(define-data-var contract-owner principal tx-sender)

;; ----------------------------------------------------------------------------
;; Public Functions
;; ----------------------------------------------------------------------------

;; @desc Anchor a new V-UTXO (Lifting process)
;; @param vutxo-id: (buff 32) - The unique identifier for the VTXO
;; @param amount: uint - The amount in sats
;; @param owner: principal - The sovereign owner of the VTXO
;; @param owner-pubkey: (buff 33) - The owner's public key for signature verification
;; @param server-pubkey: (buff 33) - The ASP public key
;; @param expiry: uint - The block height of expiration
;; Complexity: $O(1)$
(define-public (anchor-vutxo (vutxo-id (buff 32)) (amount uint) (owner principal) (owner-pubkey (buff 33)) (server-pubkey (buff 33)) (expiry uint))
  (begin
    ;; Access Control: Only authorized relayers or owner
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err u100))
    (asserts! (is-none (map-get? vutxos { id: vutxo-id })) (err u200))

    (map-set vutxos
      { id: vutxo-id }
      {
        amount: amount,
        owner: owner,
        owner-pubkey: owner-pubkey,
        server-pubkey: server-pubkey,
        status: "available",
        expiry: expiry
      }
    )

    (print { event: "vutxo-anchored", id: vutxo-id, amount: amount, owner: owner })
    (ok true)
  )
)

;; @desc Forfeit a V-UTXO (Off-chain Transfer verification)
;; @param vutxo-id: (buff 32) - The VTXO being forfeited
;; @param signature: (buff 65) - Conclave-signed authorization
;; @param pubkey: (buff 33) - Public key for verification
;; @param signer-trait: <sovereign-signer-trait> - The trait for signature verification
;; Complexity: $O(1)$
(define-public (forfeit-vutxo (vutxo-id (buff 32)) (signature (buff 65)) (pubkey (buff 33)) (signer-trait <sovereign-signer-trait>))
  (let
    (
      (vutxo (unwrap! (map-get? vutxos { id: vutxo-id }) (err u201)))
      (msg-hash (sha256 (unwrap! (to-consensus-buff { vutxo-id: vutxo-id, action: "forfeit" }) (err u202))))
    )
    ;; 1. Logic Guards: Check status and verify the pubkey belongs to the owner or server
    (asserts! (is-eq (get status vutxo) "available") (err u203))
    (asserts! (or (is-eq pubkey (get owner-pubkey vutxo)) (is-eq pubkey (get server-pubkey vutxo))) (err u205))

    ;; 2. Verify Conclave Signature using the provided trait
    (asserts! (unwrap! (contract-call? signer-trait verify-signature msg-hash signature pubkey) (err u204)) (err u204))

    ;; 3. State Update
    (map-set vutxos
      { id: vutxo-id }
      (merge vutxo { status: "forfeited" })
    )

    (print { event: "vutxo-forfeited", id: vutxo-id, signer: pubkey })
    (ok true)
  )
)

;; @desc Redeem a V-UTXO (Unilateral Exit)
;; @param vutxo-id: (buff 32) - The VTXO to redeem on-chain
;; @param signature: (buff 65) - Conclave-signed redemption
;; @param pubkey: (buff 33) - Signer public key
;; @param signer-trait: <sovereign-signer-trait> - The trait for signature verification
;; Complexity: $O(1)$
(define-public (redeem-vutxo (vutxo-id (buff 32)) (signature (buff 65)) (pubkey (buff 33)) (signer-trait <sovereign-signer-trait>))
  (let
    (
      (vutxo (unwrap! (map-get? vutxos { id: vutxo-id }) (err u201)))
      (msg-hash (sha256 (unwrap! (to-consensus-buff { vutxo-id: vutxo-id, action: "redeem" }) (err u202))))
    )
    ;; 1. Logic Guards: Check status and verify the pubkey belongs to the owner
    (asserts! (is-eq (get status vutxo) "available") (err u203))
    (asserts! (is-eq pubkey (get owner-pubkey vutxo)) (err u205))

    ;; 2. Verify Conclave Signature using the provided trait
    (asserts! (unwrap! (contract-call? signer-trait verify-signature msg-hash signature pubkey) (err u204)) (err u204))

    ;; 3. State Update
    (map-set vutxos
      { id: vutxo-id }
      (merge vutxo { status: "spent" })
    )

    (print { event: "vutxo-redeemed", id: vutxo-id, amount: (get amount vutxo) })
    (ok true)
  )
)

;; ----------------------------------------------------------------------------
;; Read-Only Functions (Optimization for state access)
;; ----------------------------------------------------------------------------

;; @desc Fetch current state of a VTXO
(define-read-only (get-vutxo-state (vutxo-id (buff 32)))
  (map-get? vutxos { id: vutxo-id })
)

;; @desc Verify if a VTXO is available for redemption/transfer
(define-read-only (is-vutxo-available (vutxo-id (buff 32)))
  (match (map-get? vutxos { id: vutxo-id })
    vutxo (is-eq (get status vutxo) "available")
    false
  )
)
