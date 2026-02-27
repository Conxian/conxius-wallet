import * as bitcoin from 'bitcoinjs-lib';
import { Network, Asset } from '../types';
import { endpointsFor, fetchWithRetry } from './network';
import { fetchBtcPrice } from './prices';
import { aggregatePubkeys as musig2Aggregate } from './musig2';

/**
 * Multi-Sig Service (M6 & M13 Implementation)
 * Handles address derivation, balance fetching, and transaction building for multi-sig quorums.
 */

export interface MultiSigQuorum {
    name: string;
    m: number;
    n: number;
    publicKeys: string[]; // Hex encoded
    network: Network;
}

/**
 * Derives a P2WSH Multi-Sig address from a quorum definition.
 */
export const deriveMultiSigAddress = (quorum: MultiSigQuorum): string => {
    const net = quorum.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    const pubkeys = quorum.publicKeys.map(hex => Buffer.from(hex, 'hex'));

    const p2ms = bitcoin.payments.p2ms({
        m: quorum.m,
        pubkeys,
        network: net,
    });

    const p2wsh = bitcoin.payments.p2wsh({
        redeem: p2ms,
        network: net,
    });

    return p2wsh.address!;
};

/**
 * Fetches balances for a Multi-Sig address.
 */
export const fetchMultiSigBalances = async (quorum: MultiSigQuorum): Promise<Asset[]> => {
    const address = deriveMultiSigAddress(quorum);
    const { BTC_API } = endpointsFor(quorum.network);

    try {
        const response = await fetchWithRetry(`${BTC_API}/address/${address}/utxo`);
        if (!response.ok) return [];

        const utxos = await response.json();
        const btcPrice = await fetchBtcPrice();

        const totalSats = utxos.reduce((acc: number, utxo: any) => acc + utxo.value, 0);
        const balance = totalSats / 1e8;

        return [{
            id: `multisig-${quorum.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: quorum.name,
            symbol: 'BTC',
            balance: balance,
            valueUsd: balance * btcPrice,
            layer: 'Mainnet',
            type: 'Native',
            address
        }];
    } catch (e) {
        console.error('[MultiSig] Fetch failed', e);
        return [];
    }
};

/**
 * Build a PSBT for spending from a multi-sig address.
 */
export const buildMultiSigPsbt = (
    quorum: MultiSigQuorum,
    utxos: any[],
    recipient: string,
    amountSats: number,
    feeRate: number = 5
): bitcoin.Psbt => {
    const net = quorum.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    const psbt = new bitcoin.Psbt({ network: net });

    const pubkeys = quorum.publicKeys.map(hex => Buffer.from(hex, 'hex'));
    const p2ms = bitcoin.payments.p2ms({ m: quorum.m, pubkeys, network: net });
    const p2wsh = bitcoin.payments.p2wsh({ redeem: p2ms, network: net });

    let totalIn = 0;
    utxos.forEach(utxo => {
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: p2wsh.output!,
                value: BigInt(utxo.value)
            },
            witnessScript: p2wsh.redeem!.output!
        });
        totalIn += utxo.value;
    });

    psbt.addOutput({
        address: recipient,
        value: BigInt(amountSats)
    });

    const change = totalIn - amountSats - 1000; // Simplified fee calculation
    if (change > 546) {
        psbt.addOutput({
            address: deriveMultiSigAddress(quorum),
            value: BigInt(change)
        });
    }

    return psbt;
};

/**
 * Musig2 Support (M13 Implementation)
 */
export const deriveMusig2TaprootAddress = (pubkeys: string[], network: Network): string => {
    const net = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    const aggregated = musig2Aggregate(pubkeys.map(hex => Buffer.from(hex, 'hex')));

    try {
        const { address } = bitcoin.payments.p2tr({
            internalPubkey: aggregated,
            network: net
        });
        return address!;
    } catch (e) {
        console.error("[MultiSig] P2TR Error:", e);
        return "bc1p_musig2_derived_error";
    }
};
