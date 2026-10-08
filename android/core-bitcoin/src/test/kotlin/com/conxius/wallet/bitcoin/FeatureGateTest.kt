package com.conxius.wallet.bitcoin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FeatureGateTest {

    @Test
    fun productionEnabled_is_the_expected_core_set() {
        assertEquals(
            setOf(
                FeatureGate.BABYLON,
                FeatureGate.BDK,
                FeatureGate.EVM,
                FeatureGate.LIQUID,
                FeatureGate.MUSIG2,
                FeatureGate.NWC,
                FeatureGate.SILENT_PAYMENTS,
                FeatureGate.STACKS,
            ),
            FeatureGate.productionEnabled(),
        )
    }

    @Test
    fun gated_capabilities_default_to_fail_closed() {
        val gated = FeatureGate.entries.filter { !it.productionEnabled }.toSet()
        assertTrue(FeatureGate.ARK in gated)
        assertTrue(FeatureGate.BITVM in gated)
        assertTrue(FeatureGate.LIGHTNING in gated)
        assertTrue(FeatureGate.RGB in gated)
        assertEquals(13, gated.size)
    }

    @Test
    fun guard_reports_enablement_consistently_with_registry() {
        for (gate in FeatureGate.entries) {
            assertEquals(gate.productionEnabled, ProductionRuntimeGuard.isProductionEnabled(gate))
        }
    }

    @Test
    fun registry_is_complete() {
        assertEquals(21, FeatureGate.entries.size)
    }

    @Test
    fun every_gated_feature_is_reported_disabled() {
        for (gate in FeatureGate.entries.filter { !it.productionEnabled }) {
            assertFalse(ProductionRuntimeGuard.isProductionEnabled(gate))
        }
    }
}
