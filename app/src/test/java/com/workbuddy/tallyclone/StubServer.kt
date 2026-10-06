package com.workbuddy.tallyclone

import java.io.BufferedInputStream
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.util.Collections

/**
 * The smallest HTTP/1.1 responder that [java.net.HttpURLConnection] will accept:
 * one request per connection, `Connection: close`, JSON back.
 *
 * Hand-rolled on [ServerSocket] because `com.sun.net.httpserver` is **not** on
 * the Android bootclasspath — JVM unit tests compile against `android.jar`, so
 * `HttpServer` is simply unresolved there. `ServerSocket` is on the bootclasspath
 * and works everywhere.
 *
 * [requests] records method, path and headers for every call, which is how a
 * test can prove the `X-HTTP-Method-Override` trick that `ApiClient` uses to
 * send a PATCH from `HttpURLConnection` (which refuses any verb outside its
 * fixed list). Look the entry up **by path**, not by position: a write is
 * usually followed by a refresh GET, so "the last request" is rarely the one
 * under test.
 */
internal data class RecordedRequest(
    val method: String,
    val path: String,
    val headers: Map<String, String>,
)

internal class StubServer(
    private val handler: (method: String, path: String, body: String) -> String,
) {
    private val socket = ServerSocket(0, 16, InetAddress.getByName("127.0.0.1"))

    val port: Int get() = socket.localPort

    /** Every accepted request, in arrival order. */
    val requests: MutableList<RecordedRequest> =
        Collections.synchronizedList(mutableListOf<RecordedRequest>())

    private val worker = Thread {
        while (!socket.isClosed) {
            try {
                socket.accept().use { client ->
                    val input = BufferedInputStream(client.getInputStream())
                    val requestLine = readLine(input) ?: return@use
                    val parts = requestLine.split(' ')
                    val method = parts.getOrElse(0) { "GET" }
                    val path = parts.getOrElse(1) { "/" }

                    val headers = LinkedHashMap<String, String>()
                    var contentLength = 0
                    while (true) {
                        val header = readLine(input) ?: break
                        if (header.isEmpty()) break
                        val colon = header.indexOf(':')
                        if (colon > 0) {
                            val name = header.substring(0, colon).trim().lowercase()
                            val value = header.substring(colon + 1).trim()
                            headers[name] = value
                            if (name == "content-length") {
                                contentLength = value.toIntOrNull() ?: 0
                            }
                        }
                    }
                    requests.add(RecordedRequest(method, path, headers))

                    val body = if (contentLength > 0) {
                        val buf = ByteArray(contentLength)
                        var read = 0
                        while (read < contentLength) {
                            val n = input.read(buf, read, contentLength - read)
                            if (n < 0) break
                            read += n
                        }
                        String(buf, 0, read, Charsets.UTF_8)
                    } else {
                        ""
                    }

                    val bytes = handler(method, path, body).toByteArray(Charsets.UTF_8)
                    val out = client.getOutputStream()
                    out.write(
                        (
                            "HTTP/1.1 200 OK\r\n" +
                                "Content-Type: application/json; charset=utf-8\r\n" +
                                "Content-Length: ${bytes.size}\r\n" +
                                "Connection: close\r\n\r\n"
                            ).toByteArray(Charsets.UTF_8),
                    )
                    out.write(bytes)
                    out.flush()
                }
            } catch (_: Exception) {
                // The socket was closed by stop(), or a client went away.
            }
        }
    }.apply {
        isDaemon = true
        start()
    }

    fun stop() {
        runCatching { socket.close() }
        worker.interrupt()
    }

    private fun readLine(input: InputStream): String? {
        val line = StringBuilder()
        while (true) {
            val c = input.read()
            if (c < 0) return if (line.isEmpty()) null else line.toString()
            if (c == '\r'.code) {
                input.read() // the \n
                return line.toString()
            }
            line.append(c.toChar())
        }
    }
}
