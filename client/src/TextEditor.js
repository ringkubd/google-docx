import React, {useCallback, useEffect, useRef, useState} from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css"
import "quill/dist/quill.bubble.css";
import './style.css';
import { io } from "socket.io-client"
import { useParams } from "react-router-dom";
import QuillCursors from "quill-cursors";
import  { v4 as uuidV4 } from "uuid";
import sampleHtml from "./smaplehtml";
import QuillBetterTable from 'quill-better-table'
import * as QuillTableUI from 'quill-table-ui'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComment } from '@fortawesome/free-solid-svg-icons'

Quill.register('modules/cursors', QuillCursors, true)
Quill.register('modules/table', QuillBetterTable, true)
Quill.register({'modules/tableUI': QuillTableUI}, true)

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
    [ { history: ['redo', 'undo'] } ],
    ['air-bar'],
]

const SAVE_INTERVAL_MS = 2000
const randomColor = Math.floor(Math.random()*16777215).toString(16);


function updateCursor(cursors,range, cursorid) {
    // Use a timeout to simulate a high latency connection.
    setTimeout(() => cursors.moveCursor(cursorid, range), 1000);
}

// function drawComments(metaData) {
//     var commentContainer = $("#comments-container");
//     var content = "";
//     metaData.forEach(function(index, value) {
//         content +=
//             "<a class='comment-link' href='#' data-index='" +
//             index +
//             "'><li class='list-group-item'>" +
//             value.comment +
//             "</li></a>";
//     });
//     commentContainer.html(content);
// }

// $(document).on('click','.comment-link',function () {
//     var index = $(this).data('index');
//     console.log("comment link called",index);
//     var data = metaData[index];
//     quill.setSelection(data.range.index, data.range.length);
// });


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
    const [metaData, setMetaData] = useState()
    const inlineToolbar = useRef()
    const comment = useRef()
    const commentIcon = useRef()
    const commentsContainer = useRef()

    const [ commentText, setCommentText ] = useState()

    useEffect(() => {
        const s = io("http://localhost:3001")
        setSocket(s)
        return () => {
            return s.disconnect()
        }
    }, [])

    const clickComment = (e) => {
        comment.current.style.display = 'block'
        commentIcon.current.style.display = 'none'
    }

    const onChangeComment = (e) =>{
        setCommentText(e.target.value)
    }

    const submitComment = (e) => {
        e.preventDefault()
        if (commentText){
            var range = quill.getSelection();
            console.log(range)
            if (range){
                if (range.length == 0) {
                    alert("Please select text", range.index);
                }else {
                    var text = quill.getText(range.index, range.length);
                    console.log("User has highlighted: ", text);
                    setMetaData({ range: range, comment: prompt })
                    quill.formatText(range.index, range.length, {
                        background: "#fff72b"
                    });
                }
            }
        }
    }

     const drawComments = (metaData) =>{
        var commentContainer = commentsContainer.current;
        var content = "";
        metaData.forEach(function(index, value) {
            content +=
                "<a class='comment-link' href='#' data-index='" +
                index +
                "'><li class='list-group-item'>" +
                value.comment +
                "</li></a>";
        });
        commentContainer.innerHtml(content);
    }

    useEffect(()=> {
        if (quill == null || socket == null) return
        let toolbar = inlineToolbar.current
        toolbar.style.visibility = "hidden";
        toolbar.style.position = "absolute";
        var toolbar_width = toolbar.offsetWidth, // get the width and height so we can keep it from squashing at the edge of the page
            toolbar_height = toolbar.offsetHeight;
        toolbar.style.display = "none"; // hide it if it's not hidden already.
        toolbar.style.visibility = "visible";
        toolbar.style.opacity = "0";
        toolbar.style.position = "fixed";
        toolbar.style.transition = "opacity 300ms, left 300ms, top 300ms";

        comment.current.style.display = 'none'

        quill.on('selection-change', function (range, oldRange, source) {
            if (range == null || source === "api") return

            if (range.length === 0) { // no selection, fade out.
                toolbar.style.opacity = 0;
                setTimeout(function () {
                    toolbar.style.display = "none"
                }, 300);
            } else {
                var selection_dimensions = window.getSelection().getRangeAt(0).getBoundingClientRect(); // see http://stackoverflow.com/a/17887684/2661831 . Probably alchemy and/or black magic.
                // if we're going to bump into the side of the window, go to the edge less 10px.
                if (toolbar_height + selection_dimensions.bottom > window.innerHeight) {
                    toolbar.style.top = window.innerHeight + (toolbar_height + 0) + "px";
                } else {
                    toolbar.style.top = selection_dimensions.bottom - 30 + "px";
                }

                if (toolbar_width + selection_dimensions.right > window.innerWidth) {
                    toolbar.style.left = window.innerWidth - (toolbar_width + 10) + "px";
                } else {
                    toolbar.style.left = selection_dimensions.right + 0 + "px";
                }

                toolbar.style.display = "block";
                toolbar.style.opacity = 1;
                toolbar.style.zIndex = 888;

                comment.current.style.display = 'none'
                commentIcon.current.style.display = 'block'

            }
        });

        return () => {

        }
    }, [quill])

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
            if (document == ""){
                var delta = quill.clipboard.convert({html: sampleHtml}, 'silent')
                quill.setContents(delta, 'silent')
            }else{
                quill.setContents(document)
            }
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
            modules: {
                toolbar: TOOLBAR_OPTIONS,
                table: true,
                cursors: {
                    hideDelayMs: 5000,
                    hideSpeedMs: 0,
                    selectionChangeSource: null,
                    transformOnTextChange: true,
                },
                history: {
                    delay: 2000,
                    maxStack: 500,
                    userOnly: true
                },
            },
            keyboard: {
                bindings: QuillBetterTable.keyboardBindings
            }
        })
        q.disable()
        q.setText("Loading.....")
        setQuill(q)

    }, [])
    return (
        <div>
            <div className="inlineToolbar" ref={inlineToolbar}>
                <form action="" onSubmit={submitComment}>
                    <span className="ql-formats">
                        <input type="button" className="ql-air-bar" type="text" hidden ref={comment} onChange={onChangeComment}/>
                    </span>
                </form>
                <span className="ql-formats" ref={commentIcon}>
                    <button type="button" className="ql-air-bar">
                        <FontAwesomeIcon onClick={clickComment}  icon={faComment}  style={{cursor: 'hand'}}/>
                    </button>
                </span>
            </div>
            <div className="container" ref={wrapper}></div>
            <div className="commentsContainer" ref={commentsContainer}></div>
        </div>
    )
}