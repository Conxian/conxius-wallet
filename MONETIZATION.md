# MONETIZATION.md

## 1. Gas Abstraction Model

The Conxius Wallet will implement a "Gas Abstraction" model to simplify the user experience for cross-chain transactions.

*   **User Experience:** Users will pay for cross-chain transactions in the native token of the source chain (e.g., sBTC on Stacks).
*   **Backend Implementation:** The Conxius backend will automatically swap the user's payment for the gas token of the destination chain (e.g., ETH for a transaction on Rootstock).
*   **Benefits:** This model will abstract away the complexity of managing multiple gas tokens, making it easier for users to interact with the multi-chain ecosystem.

## 2. Fee Structure

The Conxius Wallet will charge a convenience fee for cross-chain transactions.

*   **Wormhole NTT Transfers:** A 0.1% convenience fee will be charged on all Wormhole NTT transfers. This fee will be used to cover the costs of the Wormhole Relayer and the gas abstraction service.
*   **Future Services:** Additional fees may be introduced for future services, such as premium support or advanced features.

## 3. B2B SDK Strategy

The "Conclave" TEE technology will be packaged as a B2B SDK for other wallets and applications to integrate.

*   **Licensing Model:** A licensing fee will be charged for the use of the Conclave SDK.
*   **Revenue Share:** A revenue-sharing model may be implemented for applications that use the Conclave SDK to power their own monetization strategies.
