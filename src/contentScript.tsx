/// <reference types="@types/resize-observer-browser">
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

// TODO: Shake Tree!
import Link from "@material-ui/core/Link";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";
import IconButton from "@material-ui/core/IconButton";

import DeleteIcon from "@material-ui/icons/Delete";
import NoteAdd from "@material-ui/icons/NoteAdd";

import debounce from "lodash/debounce";
import produce from "immer";

import { waitFor, formatVideoTime, useSmoothScroll } from "./utils";

console.log("Youtube Memo is running");

type Memo = {
  notes: {
    content: string,
    time: number,
  }[]
};

(async () => {
  const urlString = window.location.href;
  const url = new URL(urlString);
  const videoUrl = `youtube:${url.searchParams.get("v")}`;

  const initialComments: Memo = await new Promise((resolve) =>
    chrome.storage.local.get([videoUrl], (i) => resolve(i[videoUrl] || { notes: [] })));

  const flushComments = debounce((notes: Memo["notes"]) => {
    if (notes.length === 0) {
      chrome.storage.local.remove(videoUrl)
    } else {
      chrome.runtime.sendMessage({ type: "addBookmark", url: url.toString(), title: document.title });
      chrome.storage.local.set({ [videoUrl]: { notes } })
    }
  }, 5000, { maxWait: 20000 })

  window.onbeforeunload = flushComments.flush;

  if ((window as any).$destroyYoutubeMemoScript) {
    (window as any).$destroyYoutubeMemoScript();
    delete (window as any).$destroyYoutubeMemoScript;
  }

  const secondaryInner = await waitFor<HTMLDivElement>("#secondary-inner");
  // There are two #secondary!
  const secondary = secondaryInner.parentElement;

  const container = document.createElement("div");
  const containerClass = "note-container";
  container.classList.add(containerClass)
  const oldContainers = secondary.getElementsByClassName(containerClass);
  for (let i = 0; oldContainers.length; i++) {
    oldContainers[i].remove();
  }
  secondary.prepend(container);

  const player = await waitFor("#primary #player");
  const video = await waitFor<HTMLVideoElement>("#player video");

  function App() {
    const [comments, setComments] = useState<Memo["notes"]>(initialComments.notes);

    const [maxHeight, setMaxHeight] = useState<number>(player.scrollHeight);

    const [focused, setFocused] = useState<number>()
    const [toFocus, setToFocus] = useState<number>()
    const observer = useRef<ResizeObserver>(null);

    useEffect(() => {
      observer.current = new ResizeObserver((e) => {
        setMaxHeight(e[0]?.contentRect.height)
      });
      observer.current.observe(player);
      return () => {
        observer.current!.disconnect()
      }
    }, [])


    const getLatestCommentIndex = (time) => {
      let i = 0;
      for (; i < comments.length && comments[i].time <= time; i++) {
      }
      return i - 1;
    }

    const [selected, setSelected] = useState(() => getLatestCommentIndex(video.currentTime));

    useEffect(() => {
      video.ontimeupdate = (e) => {
        setSelected(getLatestCommentIndex(video.currentTime));
      };
      return () => {
        delete video.ontimeupdate;
      }
    }, [comments])


    const addComment = (time: number) => {
      let i = 0;
      for (; i < comments.length; i++) {
        if (Math.floor(comments[i].time) === Math.floor(time)) {
          inputsRef.current[i].focus();
          return;
        } else if (comments[i].time > time) {
          break;
        }
      }
      setToFocus(i);
      setComments(comments.slice(0, i).concat([{ content: "", time }]).concat(comments.slice(i)))
    }

    useEffect(() => {
      if (toFocus !== undefined) {
        inputsRef.current[toFocus].focus();
      }
    }, [toFocus])

    const listRef = useRef<HTMLElement>();
    const itemsRef = useRef<HTMLElement[]>([]);
    const inputsRef = useRef<HTMLElement[]>([]);


    useEffect(() => {
      if (focused) {
        return;
      }
      if (selected === -1) {
        scroll(0);
      } else {
        scroll(itemsRef.current![selected].offsetTop, (height) => height / 3);
      }
    }, [selected]);

    useEffect(() => {
      flushComments(comments)
      itemsRef.current = itemsRef.current.slice(0, comments.length);
      inputsRef.current = inputsRef.current.slice(0, comments.length);
    }, [comments]);

    const handleChange = useCallback((index: number, value: string) => {
      setComments(produce(($) => {
        $[index].content = value;
      }, comments));
    }, [comments]);

    const scroll = useSmoothScroll(listRef.current);

    return (
      <div style={{ display: "flex", flexDirection: "column", maxHeight, overflow: "hidden" }}>
        <Button
          fullWidth
          onClick={() => addComment(video.currentTime)} startIcon={<NoteAdd />}>Add Note</Button>
        <List ref={listRef as any} style={{ padding: 0, overflowY: "auto" }}>
          {comments.map((i, index) =>
            <ListItem
              key={i.time}
              ref={(el) => itemsRef.current[index] = el}
              selected={focused === undefined ? selected === index : focused === index}>
              <Link
                href="#"
                variant="caption"
                onClick={(e) => {
                  video.currentTime = i.time;
                  e.preventDefault();
                }}>
                {formatVideoTime(i.time)}
              </Link>
              <Box width={1} marginLeft={1}>
                <TextField inputRef={(el) => inputsRef.current[index] = el}
                  fullWidth
                  autoFocus={selected === index}
                  value={i.content}
                  onFocus={() => setFocused(index)}
                  onBlur={() => setFocused(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addComment(video.currentTime);
                    }
                  }}
                  onChange={(e) => handleChange(index, e.currentTarget.value)} />
              </Box>
              <ListItemSecondaryAction>
                <IconButton
                  tabIndex={-1}
                  edge="end"
                  aria-label="delete"
                  onClick={() =>
                    setComments(produce(($) => {
                      $.splice(index, 1);
                    }, comments))}>
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          )}
        </List>
      </div>)
  }
  ReactDOM.render(<App />, container);

  (window as any).$destroyYoutubeMemoScript = () => {
    ReactDOM.unmountComponentAtNode(container);
  };
})();