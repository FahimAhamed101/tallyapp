package com.workbuddy.tallyclone.data

import android.content.ContentResolver
import android.net.Uri
import android.provider.ContactsContract

/**
 * Reads one picked contact out of the phonebook.
 *
 * Uses `ActivityResultContracts.PickContact`, which hands back a content:// URI
 * carrying a per-URI read grant — so the ফোনবুক button needs **no
 * READ_CONTACTS permission** (and none is requested): the user already chose
 * this one contact, and a manifest permission would be over-ask.
 */
object PhoneBook {

    data class Contact(val name: String, val phone: String)

    /** Resolves the display name and first phone number behind [uri]. */
    fun readContact(resolver: ContentResolver, uri: Uri): Contact? {
        val name = queryString(resolver, uri, ContactsContract.Contacts.DISPLAY_NAME)
            ?: return null
        val contactId = queryString(resolver, uri, ContactsContract.Contacts._ID)
        val phone = if (contactId != null) firstPhone(resolver, contactId) else null
        return contact(name, phone)
    }

    private fun firstPhone(resolver: ContentResolver, contactId: String): String? =
        resolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER),
            "${ContactsContract.CommonDataKinds.Phone.CONTACT_ID} = ?",
            arrayOf(contactId),
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
        }

    private fun queryString(resolver: ContentResolver, uri: Uri, column: String): String? =
        resolver.query(uri, arrayOf(column), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
        }

    /**
     * The pure decision half of [readContact]: a contact is only usable when it
     * has both a name and a phone number, and the phone must end up in the
     * local format the form (and the seeded book) uses.
     */
    fun contact(name: String?, phone: String?): Contact? {
        val trimmedName = name?.trim().orEmpty()
        val normalized = normalizePhone(phone.orEmpty())
        if (trimmedName.isEmpty() || normalized.isEmpty()) return null
        return Contact(trimmedName, normalized)
    }

    /**
     * +8801712345678 -> 01712345678 (also 00-prefixed international form).
     * Anything without a country prefix is passed through digits-only, so a
     * number already stored locally is left untouched.
     */
    fun normalizePhone(raw: String): String {
        val digits = raw.filter { it.isDigit() }
        return when {
            digits.startsWith("880") && digits.length >= 13 -> "0" + digits.removePrefix("880")
            digits.startsWith("00") && digits.length >= 13 -> "0" + digits.removePrefix("00")
            else -> digits
        }
    }
}
