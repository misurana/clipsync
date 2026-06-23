package com.clipsync.keyboard

import android.inputmethodservice.InputMethodService
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Button

/**
 * Attaches click listeners to all keyboard key buttons.
 * Each button's android:tag in XML is the key value to commit.
 */
class KeyboardKeyListener(private val ims: InputMethodService) {

    fun attachTo(container: View) {
        if (container is ViewGroup) {
            for (i in 0 until container.childCount) {
                attachTo(container.getChildAt(i))
            }
        } else if (container is Button) {
            val tag = container.tag as? String ?: return
            container.setOnClickListener { handleKey(tag) }
        }
    }

    private fun handleKey(key: String) {
        val ic = ims.currentInputConnection ?: return
        when (key) {
            "DEL"   -> ic.deleteSurroundingText(1, 0)
            "ENTER" -> ic.sendKeyEvent(
                KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER)
            )
            "SPACE" -> ic.commitText(" ", 1)
            "SHIFT" -> { /* TODO: toggle shift state */ }
            "?123"  -> { /* TODO: switch to number layout */ }
            else    -> ic.commitText(key, 1)
        }
    }
}
