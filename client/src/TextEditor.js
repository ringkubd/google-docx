import React, {useCallback, useEffect, useState} from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css"
import './style.css';
import { io } from "socket.io-client"
import { useParams } from "react-router-dom";
import QuillCursors from "quill-cursors";

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

    ['clean']
]

const SAVE_INTERVAL_MS = 2000

export default function TextEditor(){
    const {id: documentId} = useParams()
    const [quill, setQuill] = useState()
    const [socket, setSocket] = useState()

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
            socket.emit('send-selection', range)
            let cursor = quill.getModule('cursors')
            cursor = cursor.createCursor("123", "67489", 'red')
            console.log(cursor)
        }

        quill.on('selection-change',handler)

        return () => {
            quill.off('selection-change')
        }
    })

    // Update Selection

    useEffect(() => {
        if (quill == null || socket == null) return
        socket.on('receive-selection', range => {
            quill.setSelection(range)
            quill.format('color', 'red');
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

        const editor = document.createElement('div');
        wrapper.append(editor)

        let q = new Quill(editor, {
            theme: "snow",
            modules: {
                cursors: {
                    hideDelayMs: 5000,
                    hideSpeedMs: 0,
                    selectionChangeSource: null,
                    transformOnTextChange: true,
                },
                toolbar: TOOLBAR_OPTIONS
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