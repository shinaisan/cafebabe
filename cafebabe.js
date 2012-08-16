/* -*- coding: utf-8-unix; mode: java; indent-tabs-mode: nil; -*- */

$(window).load(function(){
        // Constant pool tags
        var constantTagNames = {
            7 : "Class",
            9 : "Fieldref",
            10 : "Methodref",
            11 : "InterfaceMethodref",
            8 : "String",
            3 : "Integer",
            4 : "Float",
            5 : "Long",
            6 : "Double",
            12 : "NameAndType",
            1 : "Utf8",
            15 : "MethodHandle",
            16 : "MethodType",
            18 : "InvokeDynamic"
        };
        // Convert an integer d to a hexadecimal string of length padding (default 2).
        function dec2hex(d, padding) {
            var hex = Number(d >>> 0).toString(16);
            padding = ((typeof(padding) === "number") ? padding : 2);
            while (hex.length < padding) {
                hex = "0" + hex;
            }
            return hex;
        }
        // Replace every markup character with a corresponding entity reference.
        function esc(s) {
            return s.replace(/["&'<>]/g, // '"]
                             function (c) {
                                 return {
                                     '"' : "&quot;",
                                         '&' : "&amp;",
                                         "'" : "&#39;",
                                         "<" : "&lt;",
                                         ">" : "&gt;"
                                         }[c];
                             });
        }
        // Construct a string from a UTF8 bytes.
        // See 4.4.7. The CONSTANT_Utf8_info Structure in The Java^(TM) Virtual Machine Specification Java SE 7 Edition
        function utf8ToString(utf8) {
            var a = new Array();
            var i = 0;
            while (i < utf8.length) {
                var b1 = utf8[i++] >>> 0;
                if (b1 < 0x80) {
                    a.push(b1);
                } else if ((b1 >= 0xc0) && (b1 < 0xe0)) {
                    var b2 = utf8[i++] >>> 0;
                    a.push(((b1 & 0x1f) << 6) + (b2 & 0x3f));
                } else if ((b1 >= 0xe0) && (b1 < 0xf0)) {
                    var b2 = utf8[i++] >>> 0;
                    var b3 = utf8[i++] >>> 0;
                    a.push(((b1 & 0xf) << 12) + ((b2 & 0x3f) << 6) + (b3 & 0x3f));
                } else if (b1 == 0xed) {
                    var b2 = utf8[i++] >>> 0;
                    var b3 = utf8[i++] >>> 0;
                    var b4 = utf8[i++] >>> 0;
                    var b5 = utf8[i++] >>> 0;
                    var b6 = utf8[i++] >>> 0;
                    a.push(0x10000 + ((b2 & 0x0f) << 16) + ((b3 & 0x3f) << 10) + ((b5 & 0x0f) << 6) + (b6 & 0x3f));
                }
            }
            return String.fromCharCode.apply("", a);
        }
        // Set a text in the alert area.
        function setAlert(t) {
            $("#alert-area").text(t);
        }
        // Clear the alert area.
        function clearAlerts() {
            $("#alertarea").empty();
        }
        // A simple stream interface for ArrayBuffer to read 1,2,4 byte/bytes in big endian and a UTF-8 bytes.
        // ab: ArrayBuffer
        // this.cursor: The current byte offset in the buffer.
        // this.latestDump: A hexadecimal representation of bytes most recently read.
        function DataInputB(ab) {
            this.buffer = new Uint8Array(ab);
            this.cursor = 0;
            this.latestDump = "";
        }
        DataInputB.prototype.u1 = function() {
            var b1 = this.buffer[this.cursor++];
            this.latestDump = dec2hex(b1);
            return b1;
        }
        DataInputB.prototype.u2 = function() {
            var b1 = this.u1();
            var b2 = this.u1();
            this.latestDump = dec2hex(b1) + " " + dec2hex(b2);
            return ((b1 << 8) | b2);
        }
        DataInputB.prototype.u4 = function() {
            var b1 = this.u1();
            var b2 = this.u1();
            var b3 = this.u1();
            var b4 = this.u1();
            this.latestDump = dec2hex(b1) + " " + dec2hex(b2) + " " + dec2hex(b3) + " " + dec2hex(b4);
            return ((b1 << 24) | (b2 << 16) | (b3 << 8) | b4);
        }
        DataInputB.prototype.utf8 = function(length) {
            if (length <= 0) {
                return "";
            }
            var sa = this.buffer.subarray(this.cursor, this.cursor + length);
            this.cursor += length;
            var d = "";
            for (var i = 0; i < length; i++) {
                d += dec2hex(sa[i]) + " ";
            }
            this.latestDump = d;
            return utf8ToString(sa);
        }
        // Generate a li element contains information of a member of a class file;
        // caption: its name, str: its value, addr: its offset in file, dump: the hex-dump of its content.
        function classFileMember(caption, str, addr, dump) {
            var li = $("<li/>")
                .append("<u><strong>" + esc(caption) + "</strong>&nbsp:&nbsp" + esc(str) + "&nbsp;</u>" +
                        "<code>address@" + dec2hex(addr, 8) + " : " + dump + "</code>");
            return li;
        }
        // input: DataInputB
        function classFileMemberU2(input, caption) {
            var address = input.cursor;
            var d = input.u2();
            return classFileMember(caption, "0x" + dec2hex(d) + " = " + d.toString(), address, input.latestDump);
        }
        // input: DataInputB
        function classFileMemberU4(input, caption) {
            var address = input.cursor;
            var d = input.u4();
            return classFileMember(caption, "0x" + dec2hex(d) + " = " + d.toString(), address, input.latestDump);
        }
        // Read class file members one by one, generate a node for each member, and add that node to the tree view.
        // input: DataInputB
        function readClassFile(input) {
            var root = $("#class-root");
            var address;
            clearAlerts();

            // u4 magic;
            address = input.cursor;
            var magic = input.u4();
            if ((magic >>> 0) != 0xcafebabe) {
                setAlert("Not a valid Java class file!");
            } else {
                setAlert("A valid Java class file!");
            }
            classFileMember("magic", "0x" + dec2hex(magic, 8), address, input.latestDump)
                .attr("id", "magic").appendTo(root);
            if ((magic >>> 0) != 0xcafebabe) {
                return;
            }

            // u2 minor_version;
            address = input.cursor;
            var minor = input.u2();
            classFileMember("minor_version", minor.toString(), address, input.latestDump).appendTo(root);
            // u2 major_version;
            address = input.cursor;
            var major = input.u2();
            classFileMember("major_version", major.toString(), address, input.latestDump).appendTo(root);
            // u2 constant_pool_count;
            address = input.cursor;
            var constant_pool_count = input.u2();
            classFileMember("constant_pool_count", constant_pool_count.toString(), address, input.latestDump).appendTo(root);
            // cp_info constant_pool[constant_pool_count - 1];
            address = input.cursor;
            var cpRoot = classFileMember("constant_pool", "", address, "...");
            cpRoot.appendTo(root);
            var cpContainer = $("<ul/>");
            cpContainer.appendTo(cpRoot);
            for (var i = 1; i < constant_pool_count; i++) {
                address = input.cursor;
                var tag = input.u1();
                var tagName = constantTagNames[tag];
                var constantRoot = classFileMember("CONSTANT[" + i + "]", tagName + " (" + tag.toString() + ")",
                                                   address, input.latestDump);
                constantRoot.attr("id", "class-constant-" + i.toString());
                constantRoot.appendTo(cpContainer);
                var constantContainer = $("<ul/>");
                constantContainer.appendTo(constantRoot);
                switch (tagName) {
                case "Class":
                    classFileMemberU2(input, "name_index").appendTo(constantContainer);
                    break;
                case "Fieldref":
                case "Methodref":
                case "InterfaceMethodref":
                    classFileMemberU2(input, "class_index").appendTo(constantContainer);
                    classFileMemberU2(input, "name_and_type_index").appendTo(constantContainer);
                    break;
                case "String":
                    classFileMemberU2(input, "string_index").appendTo(constantContainer);
                    break;
                case "Integer":
                case "Float":
                    classFileMemberU4(input, "bytes").appendTo(constantContainer);
                    break;
                case "Long":
                case "Double":
                    classFileMemberU4(input, "high_bytes").appendTo(constantContainer);
                    classFileMemberU4(input, "low_bytes").appendTo(constantContainer);
                    break;
                case "NameAndType":
                    classFileMemberU2(input, "name_index").appendTo(constantContainer);
                    classFileMemberU2(input, "descriptor_index").appendTo(constantContainer);
                    break;
                case "Utf8":
                    address = input.cursor;
                    var length = input.u2();
                    classFileMember("length", length.toString(), address, input.latestDump)
                        .appendTo(constantContainer);
                    address = input.cursor;
                    var s = input.utf8(length);
                    classFileMember("bytes", s, address, input.latestDump)
                        .appendTo(constantContainer);
                    break;
                case "MethodHandle":
                    classFileMemberU1(input, "reference_kind").appendTo(constantContainer);
                    classFileMemberU1(input, "reference_index").appendTo(constantContainer);
                    break;
                case "MethodType":
                    classFileMemberU2(input, "descriptor_index").appendTo(constantContainer);
                    break;
                case "InvokeDynamic":
                    classFileMemberU2(input, "bootstrap_method_attr_index").appendTo(constantContainer);
                    classFileMemberU2(input, "name_and_type_index").appendTo(constantContainer);
                    break;
                default:
                    address = input.cursor;
                    classFileMember("UNKNOWN", "", address, "...");
                }
            }
        }
        $(document).ready(function() {
                if (window.File && window.FileReader && window.FileList && window.Blob) {
                    setAlert("File APIs: supported");
                } else {
                    setAlert("File APIs: not supported");
                }

                // We need to do this to receive dataTransfer object in the drop event handler.
                jQuery.event.props.push("dataTransfer");
                
                // We need to bind event handlers for dragenter/dragover to stop the browser opening the file dropped.
                $("#drop-area").bind("dragenter", function(event) {
                        event.stopPropagation();
                        event.preventDefault();
                    });
                $("#drop-area").bind("dragover", function(event) {
                        event.stopPropagation();
                        event.preventDefault();
                    });
                $("#drop-area").bind("drop", function(event) {
                        event.stopPropagation();
                        event.preventDefault();
                        var files = event.dataTransfer.files;
                        if (files.length <= 0) {
                            return;
                        }
                        var treeArea = $("#class-tree");
                        var tree = $("<ul/>");
                        var heading = $("<li><a href='#'><strong>Class</strong></a></li>", {id : "class-heading"});
                        var root = $("<ul/>", {id : "class-root"});
                        treeArea.empty();
                        heading.append(root);
                        tree.append(heading);
                        treeArea.append(tree);
                        var reader = new FileReader();
                        reader.onload = function(e) {
                            var buf = e.target.result;
                            var a = new DataInputB(buf);
                            readClassFile(a);
                            $("#class-tree").jstree({"ui" : {"initially_select" : ["#magic"]}});
                        };
                        reader.readAsArrayBuffer(files[0]);
                    });

            });
    });
