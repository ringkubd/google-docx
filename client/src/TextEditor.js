import React, {useCallback, useEffect, useState} from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css"
import './style.css';
import { io } from "socket.io-client"
import { useParams } from "react-router-dom";
import QuillCursors from "quill-cursors";
import  { v4 as uuidV4 } from "uuid";
import Table from "quill/modules/table";

Quill.register('modules/cursors', QuillCursors)

const TOOLBAR_OPTIONS = [
    ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
    ['image','blockquote', 'code-block'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
    [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
    [{ 'direction': 'rtl' }],                         // text direction

    [{ 'size': ['small', false, 'large', 'huge'] }],  // custom dropdown
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],

    [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
    [{ 'font': [] }],
    [{ 'align': [] }],
    ['clean'],
    ['link'],
]

const SAVE_INTERVAL_MS = 2000
const randomColor = Math.floor(Math.random()*16777215).toString(16);

function selectionChangeHandler(cursors) {
    const debouncedUpdate = debounce(updateCursor, 500);
    return function(range, oldRange, source) {
        if (source === 'user') {
            // If the user has manually updated their selection, send this change
            // immediately, because a user update is important, and should be
            // sent as soon as possible for a smooth experience.
            updateCursor(range);
        } else {
            // Otherwise, it's a text change update or similar. These changes will
            // automatically get transformed by the receiving client without latency.
            // If we try to keep sending updates, then this will undo the low-latency
            // transformation already performed, which we don't want to do. Instead,
            // add a debounce so that we only send the update once the user has stopped
            // typing, which ensures we send the most up-to-date position (which should
            // hopefully match what the receiving client already thinks is the cursor
            // position anyway).
            debouncedUpdate(range);
        }
    };
    function updateCursor(range) {
        // Use a timeout to simulate a high latency connection.
        setTimeout(() => cursors.moveCursor('cursor', range), 1000);
    }
}
function updateCursor(cursors,range, cursorid) {
    // Use a timeout to simulate a high latency connection.
    setTimeout(() => cursors.moveCursor(cursorid, range), 1000);
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export default function TextEditor(){
    const {id: documentId} = useParams()
    const [quill, setQuill] = useState()
    const [socket, setSocket] = useState()
    const [cursor, setCursor] = useState()
    const [username, setUsername] = useState()

    useEffect(() => {
        const s = io("http://localhost:3001")
        setSocket(s)
        return () => {
            return s.disconnect()
        }
    }, [])

    // Selection Change

    useEffect(() => {
        if (quill == null || socket == null) return

        const handler =  (range, oldRange, source) => {
            if (source !== "user") return
            let selection = {
                range : range,
                name : randomColor,
                color: "#"+randomColor,
                cursorId: randomColor
            }
            socket.emit('send-selection', selection)
        }

        quill.on('selection-change',handler)

        return () => {
            quill.off('selection-change')
        }
    }, [quill, socket, cursor])

    // Update Selection

    useEffect(() => {
        if (quill == null || socket == null) return
        socket.on('receive-selection', range => {
            quill.setSelection(range.range)

            let cursor = quill.getModule('cursors');
            cursor.createCursor(range.cursorId, range.name, range.color)
            debounce(updateCursor(cursor, range.range, range.cursorId))
        })
    }, [socket, quill])

    // Set Existing Content to Quill editor

    useEffect(() => {
        if (quill == null || socket == null) return
        socket.once('load-document', document => {
            quill.setContents(document)
            quill.enable()
        })
        socket.emit('get-document', documentId)
        return () => {

        };

    }, [socket, quill, documentId])

    // Save Document to MongoDB
    useEffect(() => {
        const interval = setInterval(() => {
            socket.emit("save-document", quill.getContents())
        }, SAVE_INTERVAL_MS)

        return ()=>{
            clearInterval(interval)
        }
    }, [quill, socket])

    // Update Content from other user's change
    useEffect(() => {
        if (quill == null || socket == null) return
        const handler = (delta) => {
            quill.updateContents(delta)
        }
        socket.on("receive-changes", handler)
        return () => {
            return socket.off("receive-changes", handler)
        }
    }, [quill, socket])


    // Send Changes

    useEffect(() => {
        if (quill == null || socket == null) return
        const handler = (delta, oldDelta, source) => {
            if (source !== "user") return
            socket.emit('send-changes', delta)
        }
        quill.on("text-change", handler)
        return () => {
            return quill.off('text-change')
        }
    }, [quill, socket])

    // Initiate Quill Editor
    const wrapper = useCallback((wrapper)=> {
        if (wrapper == null) return
        wrapper.innerHTML = ""
        const userName = uuidV4()
        setUsername(userName)

        const editor = document.createElement('div');
        wrapper.append(editor)

        let q = new Quill(editor, {
            theme: "snow",
            table: true,
            modules: {
                cursors: {
                    hideDelayMs: 5000,
                    hideSpeedMs: 0,
                    selectionChangeSource: null,
                    transformOnTextChange: true,
                },
                toolbar: TOOLBAR_OPTIONS,
                history: {
                    delay: 2000,
                    maxStack: 500,
                    userOnly: true
                }
            }
        })
        q.disable()
        q.setText("Loading.....")
        setQuill(q)

    }, [])
    return (
        <div className="container" ref={wrapper}></div>
    )
}